import { describe, it, expect } from 'vitest';
import { fromCents, fromDollars, toCents, toDollars, formatMoney, addMoney, subtractMoney, compareMoney, sumMoney, toCentsFromUnknown } from '~/utils/money';

describe('money utils', () => {
  it('converts dollars to cents and back', () => {
    const m = fromDollars(12.34);
    expect(toCents(m)).toBe(1234);
    expect(toDollars(m)).toBeCloseTo(12.34, 2);
  });

  it('handles fromCents precisely', () => {
    const m = fromCents(999);
    expect(toCents(m)).toBe(999);
    expect(toDollars(m)).toBeCloseTo(9.99, 2);
  });

  it('formats with currency', () => {
    const m = fromDollars(5);
    // CAD formatting; value presence matters, locale specifics may vary slightly
    expect(formatMoney(m)).toMatch(/5\.00/);
  });

  it('performs arithmetic and comparisons', () => {
    const a = fromCents(200);
    const b = fromCents(150);
    const sum = addMoney(a, b);
    const diff = subtractMoney(a, b);
    expect(toCents(sum)).toBe(350);
    expect(toCents(diff)).toBe(50);
    expect(compareMoney(a, b)).toBe(1);
  });

  it('sums arrays', () => {
    const total = sumMoney([fromCents(1), fromCents(2), fromCents(3)]);
    expect(toCents(total)).toBe(6);
  });

  it('coerces MoneyJSON and Money objects to cents safely', () => {
    const money = fromCents(4321);
    expect(toCentsFromUnknown(money)).toBe(4321);
    expect(toCentsFromUnknown({ amount: 987, currency: 'CAD' })).toBe(987);
  });

  it('can treat numeric values as cents at DB boundaries', () => {
    expect(toCentsFromUnknown(2500, { numberUnit: 'cents' })).toBe(2500);
    expect(toCentsFromUnknown('2500', { numberUnit: 'cents' })).toBe(2500);
  });

  it('falls back safely for invalid unknown values', () => {
    expect(toCentsFromUnknown({ no: 'money' }, { fallbackCents: 77 })).toBe(77);
    expect(toCentsFromUnknown('not-a-number', { fallbackCents: 13 })).toBe(13);
  });
});
