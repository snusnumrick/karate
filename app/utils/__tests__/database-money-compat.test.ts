import { describe, expect, it } from 'vitest';
import { toCents } from '~/utils/money';
import {
  centsFromDb as sharedCentsFromDb,
  centsFromRow,
  getNum as sharedGetNum,
  moneyFromDb as sharedMoneyFromDb,
} from '../database-money';
import { centsFromDb, getNum, moneyFromDb } from '../db-money';
import { isLegacyDollars } from '../money-rules';

describe('database money compatibility', () => {
  it('keeps db-money helper exports behavior-compatible with shared helpers', () => {
    const row = {
      total_amount_cents: 1234,
      total_amount: 12.34,
      subtotal: 45.67,
    };

    expect(getNum(row, 'total_amount_cents')).toBe(sharedGetNum(row, 'total_amount_cents'));
    expect(centsFromDb(row, 'total_amount_cents', 'total_amount')).toBe(
      sharedCentsFromDb(row, 'total_amount_cents', 'total_amount')
    );
    expect(toCents(moneyFromDb(row, 'total_amount_cents', 'total_amount'))).toBe(
      toCents(sharedMoneyFromDb(row, 'total_amount_cents', 'total_amount'))
    );
  });

  it('applies legacy dollars and cents exception rules consistently', () => {
    expect(isLegacyDollars('invoices', 'subtotal')).toBe(true);
    expect(isLegacyDollars('payments', 'total_amount')).toBe(false);
    expect(isLegacyDollars('event_registrations', 'payment_amount')).toBe(false);
  });

  it('converts row values with consistent cents behavior across legacy tables', () => {
    expect(centsFromRow('invoices', 'subtotal', { subtotal: 45.67 })).toBe(4567);
    expect(centsFromRow('payments', 'total_amount', { total_amount: 9500 })).toBe(9500);
    expect(
      centsFromRow('event_registrations', 'payment_amount', { payment_amount: 5000 })
    ).toBe(5000);
  });
});
