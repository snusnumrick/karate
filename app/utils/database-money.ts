import { fromCents, fromDollars, type Money, ZERO_MONEY } from '~/utils/money';

// Tables whose legacy (non-*_cents) money fields are stored in DOLLARS.
export const LEGACY_DOLLARS_TABLES = new Set<string>([
  'invoices',
  'invoice_payments',
  'invoice_line_item_taxes',
  'invoice_template_line_items',
  'events',
  'invoice_entities',
  'programs',
  // 'payments' excluded: legacy numeric columns are INT4 cents in this schema.
  'invoice_line_items',
  'payment_taxes',
]);

// Table.field exceptions where legacy field is numeric but stored in CENTS.
export const LEGACY_CENTS_EXCEPTIONS = new Set<string>([
  'event_registrations.payment_amount',
]);

export function isLegacyDollars(table: string, field: string): boolean {
  if (LEGACY_CENTS_EXCEPTIONS.has(`${table}.${field}`)) return false;
  return LEGACY_DOLLARS_TABLES.has(table);
}

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

// Get raw cents value for a given table/field from a database row, honoring
// *_cents precedence and legacy unit rules.
export function centsFromRow(
  tableName: string,
  field: string,
  row: Record<string, unknown>
): number {
  const isCentsField = field.endsWith('_cents');
  const centsKey = isCentsField ? field : `${field}_cents`;
  const centsVal = getNum(row, centsKey);
  if (typeof centsVal === 'number') return Math.round(centsVal);

  const legacyVal = getNum(row, field);
  if (typeof legacyVal !== 'number') return 0;

  if (isCentsField) return Math.round(legacyVal);
  return isLegacyDollars(tableName, field) ? Math.round(legacyVal * 100) : Math.round(legacyVal);
}

// Get Money value for a given table/field from a database row.
export function moneyFromRow(
  tableName: string,
  field: string,
  row: Record<string, unknown>
): Money {
  return fromCents(centsFromRow(tableName, field, row));
}
