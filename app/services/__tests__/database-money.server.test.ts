import { describe, expect, it } from 'vitest';
import { centsFromRow, moneyFromRow } from '../database-money.server';
import { toCents } from '~/utils/money';

describe('database-money server wrappers', () => {
  it('uses *_cents fields when present', () => {
    const row = { total_amount: 12.34, total_amount_cents: 1234 };
    expect(centsFromRow('invoices', 'total_amount', row)).toBe(1234);
    expect(toCents(moneyFromRow('invoices', 'total_amount', row))).toBe(1234);
  });

  it('applies legacy dollars rules when *_cents is absent', () => {
    const row = { subtotal: 45.67 };
    expect(centsFromRow('invoices', 'subtotal', row)).toBe(4567);
  });

  it('keeps cent-based legacy tables in cents', () => {
    const row = { total_amount: 9500 };
    expect(centsFromRow('payments', 'total_amount', row)).toBe(9500);
  });
});
