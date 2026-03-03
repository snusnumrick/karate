import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toCents } from '~/utils/money';

/**
 * Unit tests for the getInvoiceStats aggregation logic.
 *
 * Critical regressions fixed (commit 6465fd6):
 *   - overdue_count previously included 'draft' and 'cancelled' invoices,
 *     causing the dashboard to show "N overdue" when only drafts existed.
 *   - outstanding_amount previously included drafts (unpaid balance on an
 *     unsent invoice is not yet owed).
 *   - Overpaid invoices (amount_paid > total) must not produce negative
 *     outstanding (the excess is clamped to zero).
 *
 * These tests verify all four invariants without hitting the database.
 */

// ── Supabase mock ────────────────────────────────────────────────────────────
// The query chain used by getInvoiceStats is:
//   client.from('invoices').select(...).neq('status', 'cancelled')
// mockNeq controls what rows that query "returns".
const mockNeq = vi.fn();

vi.mock('~/utils/supabase.server', () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        neq: mockNeq,
      })),
    })),
  })),
  getSupabaseServerClient: vi.fn(),
}));

// Fix "today" so due_date comparisons are deterministic.
vi.mock('~/utils/misc', () => ({
  getTodayLocalDateString: vi.fn(() => '2026-03-03'),
  formatDate: vi.fn((d: string) => d),
  getCurrentDateTimeInTimezone: vi.fn(() => new Date('2026-03-03')),
}));

// eslint-disable-next-line import/first
import { getInvoiceStats } from '~/services/invoice.server';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal invoice row (amounts in cents). */
function row(
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue',
  totalCents: number,
  paidCents: number,
  dueDateOffset: number   // days relative to today (negative = past-due)
) {
  const due = new Date('2026-03-03');
  due.setDate(due.getDate() + dueDateOffset);
  return {
    id: crypto.randomUUID(),
    status,
    due_date: due.toISOString().split('T')[0],
    total_amount_cents: totalCents,
    amount_paid_cents: paidCents,
  };
}

function setRows(rows: ReturnType<typeof row>[]) {
  mockNeq.mockResolvedValue({ data: rows, error: null });
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('getInvoiceStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── baseline ───────────────────────────────────────────────────────────────

  it('returns all-zero stats when there are no invoices', async () => {
    setRows([]);
    const stats = await getInvoiceStats();
    expect(stats.total_invoices).toBe(0);
    expect(stats.overdue_count).toBe(0);
  });

  // ── draft invoices ─────────────────────────────────────────────────────────

  describe('draft invoices', () => {
    it('does NOT count a draft as overdue even if past due', async () => {
      // This is the regression: a draft past its due_date was previously
      // counted as overdue, causing "1 overdue invoice" on the dashboard.
      setRows([row('draft', 9630, 0, -30)]);
      const stats = await getInvoiceStats();
      expect(stats.overdue_count).toBe(0);
    });

    it('does NOT include draft balance in outstanding_amount', async () => {
      setRows([row('draft', 9630, 0, -30)]);
      const stats = await getInvoiceStats();
      // outstanding_amount should stay at zero — the draft hasn't been sent yet.
      const outstandingCents = toCents(stats.outstanding_amount);
      expect(outstandingCents).toBe(0);
    });

    it('does count a draft in total_invoices and total_amount', async () => {
      // Draft invoices exist and should be reflected in totals,
      // just not in outstanding or overdue.
      setRows([row('draft', 9630, 0, 7)]);
      const stats = await getInvoiceStats();
      expect(stats.total_invoices).toBe(1);
      expect(toCents(stats.total_amount)).toBe(9630);
    });
  });

  // ── paid invoices ──────────────────────────────────────────────────────────

  describe('paid invoices', () => {
    it('does NOT count a paid invoice as overdue', async () => {
      setRows([row('paid', 10500, 10500, -10)]);
      const stats = await getInvoiceStats();
      expect(stats.overdue_count).toBe(0);
    });

    it('does NOT add a fully-paid invoice to outstanding_amount', async () => {
      setRows([row('paid', 10500, 10500, -10)]);
      const stats = await getInvoiceStats();
      expect(toCents(stats.outstanding_amount)).toBe(0);
    });

    it('does NOT create negative outstanding for overpaid invoices', async () => {
      // INV-2025-0002: paid $112 on a $105 invoice — $7 overpaid.
      // outstanding must be clamped at 0, not −$7.
      setRows([row('paid', 10500, 11200, -10)]);
      const stats = await getInvoiceStats();
      expect(toCents(stats.outstanding_amount)).toBeGreaterThanOrEqual(0);
    });
  });

  // ── sent / viewed invoices ─────────────────────────────────────────────────

  describe('sent / viewed invoices', () => {
    it('counts a sent invoice past its due date as overdue', async () => {
      setRows([row('sent', 8930, 0, -5)]);
      const stats = await getInvoiceStats();
      expect(stats.overdue_count).toBe(1);
    });

    it('counts a viewed invoice past its due date as overdue', async () => {
      setRows([row('viewed', 8930, 0, -1)]);
      const stats = await getInvoiceStats();
      expect(stats.overdue_count).toBe(1);
    });

    it('does NOT count a sent invoice with a future due date as overdue', async () => {
      setRows([row('sent', 8930, 0, +10)]);
      const stats = await getInvoiceStats();
      expect(stats.overdue_count).toBe(0);
    });

    it('adds unpaid balance of sent invoice to outstanding_amount', async () => {
      // $105 total, $15.70 paid → $89.30 outstanding
      setRows([row('sent', 10500, 1570, -5)]);
      const stats = await getInvoiceStats();
      expect(toCents(stats.outstanding_amount)).toBe(8930);
    });

    it('adds partial payment correctly to outstanding_amount', async () => {
      setRows([row('sent', 20000, 5000, -1)]);
      const stats = await getInvoiceStats();
      expect(toCents(stats.outstanding_amount)).toBe(15000);
    });
  });

  // ── mixed portfolio ────────────────────────────────────────────────────────

  describe('mixed invoice portfolio', () => {
    it('only overdue_count reflects sent/viewed past-due — not draft or paid', async () => {
      setRows([
        row('draft',  9630,   0,    -30),  // past-due draft  → NOT overdue
        row('paid',   10500, 10500, -10),  // paid             → NOT overdue
        row('paid',   10500, 11200, -10),  // overpaid         → NOT overdue
        row('sent',   8930,  0,    -5),   // sent past-due    → overdue ✓
        row('viewed', 5000,  1000, -1),   // viewed past-due  → overdue ✓
        row('sent',   12000, 0,    +14),  // sent future      → NOT overdue
      ]);
      const stats = await getInvoiceStats();
      expect(stats.overdue_count).toBe(2);
    });

    it('outstanding_amount sums only non-draft unpaid balances (positive only)', async () => {
      setRows([
        row('draft',  9630,  0,    -30),  // excluded (draft)
        row('paid',   10500, 10500, -10), // excluded (fully paid)
        row('paid',   10500, 11200, -10), // excluded (overpaid, clamped)
        row('sent',   8930,  0,    -5),  // $89.30 outstanding
        row('sent',   12000, 2000, +14), // $100.00 outstanding
      ]);
      const stats = await getInvoiceStats();
      // 8930 + 10000 = 18930 cents
      expect(toCents(stats.outstanding_amount)).toBe(18930);
    });

    it('total_invoices counts all non-cancelled rows (including drafts)', async () => {
      setRows([
        row('draft', 9630, 0, 7),
        row('sent',  8930, 0, -5),
        row('paid',  10500, 10500, -10),
      ]);
      const stats = await getInvoiceStats();
      // The DB query already excludes 'cancelled'; all returned rows are counted.
      expect(stats.total_invoices).toBe(3);
    });
  });
});
