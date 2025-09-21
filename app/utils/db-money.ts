import { fromCents, fromDollars, type Money, ZERO_MONEY } from '~/utils/money';

export function getNum(obj: unknown, key: string): number | undefined {
  if (obj && typeof obj === 'object') {
    const val = (obj as Record<string, unknown>)[key];
    if (typeof val === 'number') return val;
  }
  return undefined;
}

export function moneyFromDb(obj: unknown, centsKey: string, dollarsKey: string): Money {
  const cents = getNum(obj, centsKey);
  if (typeof cents === 'number') return fromCents(cents);
  const dollars = getNum(obj, dollarsKey);
  if (typeof dollars === 'number') return fromDollars(dollars);
  return ZERO_MONEY;
}

export function centsFromDb(
  obj: unknown,
  centsKey: string,
  dollarsOrLegacyKey: string,
  options?: { legacyIsCents?: boolean }
): number {
  const cents = getNum(obj, centsKey);
  if (typeof cents === 'number') return cents;
  const legacyVal = getNum(obj, dollarsOrLegacyKey);
  if (typeof legacyVal === 'number') {
    if (options?.legacyIsCents) return Math.round(legacyVal);
    return Math.round(legacyVal * 100);
  }
  return 0;
}
