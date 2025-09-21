import { Money, fromCents, toCents, fromDollars } from '../utils/money';
import { isLegacyDollars } from '~/utils/money-rules';
import { getNum } from '~/utils/db-money';

// Fields that should be converted to/from Money objects
export const MONEY_FIELDS = {
  discount_applications: ['discount_amount', 'final_amount', 'original_amount'],
  event_registrations: ['payment_amount'],
  events: ['late_registration_fee', 'registration_fee'],
  invoice_line_items: ['discount_amount', 'line_total', 'tax_amount', 'unit_price'],
  invoice_line_item_taxes: ['tax_amount'],
  invoice_template_line_items: ['unit_price'],
  invoice_payments: ['amount'],
  invoice_entities: ['credit_limit'],
  invoices: ['amount_due', 'amount_paid', 'discount_amount', 'subtotal', 'tax_amount', 'total_amount'],
  payment_taxes: ['tax_amount'],
  order_items: ['price_per_item_cents'],
  orders: ['total_amount_cents'],
  payments: ['discount_amount', 'subtotal_amount', 'total_amount'],
  products: ['price_in_cents'],
  programs: ['individual_session_fee', 'monthly_fee', 'registration_fee', 'yearly_fee'],
} as const;

type TableName = keyof typeof MONEY_FIELDS;

// Type for database rows with money fields as numbers (cents)

// Type for converted rows with money fields as Money objects
type ConvertedRow = Record<string, unknown> & {
  [key: string]: Money | number | string | boolean | null | undefined;
};

/**
 * Convert raw database row to Money objects
 */
// Legacy/dollars rules moved to shared utils (~/utils/money-rules)

/**
 * Get raw cents value for a given table/field from a database row, honoring
 * *_cents precedence and legacy unit rules in this module.
 */
export function centsFromRow<T extends TableName>(
  tableName: T,
  field: (typeof MONEY_FIELDS)[T][number],
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

/**
 * Get Money value for a given table/field from a database row, honoring
 * *_cents precedence and legacy unit rules in this module.
 */
export function moneyFromRow<T extends TableName>(
  tableName: T,
  field: (typeof MONEY_FIELDS)[T][number],
  row: Record<string, unknown>
): Money {
  return fromCents(centsFromRow(tableName, field, row));
}

export function convertRowToMoney<T extends TableName>(
  tableName: T,
  row: Record<string, unknown> | null
): ConvertedRow | null {
  if (!row) return row;
  
  const converted: ConvertedRow = { ...row } as ConvertedRow;
  const fields = MONEY_FIELDS[tableName];
  
  for (const field of fields) {
    const isCentsField = field.endsWith('_cents');
    const centsKey = isCentsField ? field : `${field}_cents`;
    // 1) If row has *_cents (or the field itself is *_cents), use it as cents
    if (converted[centsKey] !== null && converted[centsKey] !== undefined) {
      const targetKey = field; // keep same property name
      converted[targetKey] = fromCents(converted[centsKey] as number);
      continue;
    }
    // 2) Otherwise, fall back to legacy field with proper unit
    if (converted[field] !== null && converted[field] !== undefined) {
      const value = converted[field] as number;
      // If this field name already ends with _cents, always treat as cents
      if (isCentsField) {
        converted[field] = fromCents(value);
      } else if (isLegacyDollars(tableName, field)) {
        converted[field] = fromDollars(value);
      } else {
        // Default legacy behavior: treat numeric as cents
        converted[field] = fromCents(value);
      }
    }
  }
  
  return converted;
}

/**
 * Convert array of raw database rows to Money objects
 */
export function convertRowsToMoney<T extends TableName>(
  tableName: T,
  rows: Array<Record<string, unknown>> | null
): ConvertedRow[] | null {
  if (!rows) return rows;
  return rows.map(row => convertRowToMoney(tableName, row)).filter((row): row is ConvertedRow => row !== null);
}

/**
 * Convert Money objects to raw database values (cents)
 */
export function convertMoneyToRow<T extends TableName>(
  tableName: T,
  data: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!data) return data;
  
  const converted: Record<string, unknown> = { ...data };
  const fields = MONEY_FIELDS[tableName];
  
  for (const field of fields) {
    if (converted[field] !== null && converted[field] !== undefined) {
      // If it's already a Money object, convert to cents
      if (typeof converted[field] === 'object' && 'getAmount' in converted[field]) {
        const cents = toCents(converted[field] as Money);
        const isCentsField = field.endsWith('_cents');
        if (isCentsField) {
          // Field itself is *_cents; set only this field
          converted[field] = cents;
        } else {
          // Write both legacy field and *_cents respecting legacy dollars rule
          converted[field] = isLegacyDollars(tableName, field) ? cents / 100 : cents;
          const centsKey = `${field}_cents`;
          converted[centsKey] = cents;
        }
      }
      // If it's a number, assume it's already in cents
      else if (typeof converted[field] === 'number') {
        const isCentsField = field.endsWith('_cents');
        const cents = converted[field] as number;
        if (isCentsField) {
          converted[field] = cents;
        } else {
          // Number is treated as cents; set legacy field in dollars if needed
          converted[field] = isLegacyDollars(tableName, field) ? cents / 100 : cents;
          const centsKey = `${field}_cents`;
          converted[centsKey] = cents;
        }
      }
    }
  }
  
  return converted;
}

/**
 * Helper to check if a table has money fields
 */
export function hasMoneyFields(tableName: string): tableName is TableName {
  return tableName in MONEY_FIELDS;
}

/**
 * Get money field names for a table
 */
export function getMoneyFields(tableName: TableName): readonly string[] {
  return MONEY_FIELDS[tableName];
}

/**
 * Convert a single field value from cents to Money
 */
export function convertFieldToMoney(value: number | null | undefined): Money | null {
  if (value === null || value === undefined) return null;
  return fromCents(value);
}

/**
 * Convert a single Money field to cents
 */
export function convertFieldToCents(value: Money | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  
  if (typeof value === 'object' && 'getAmount' in value) {
    return toCents(value as Money);
  }
  
  if (typeof value === 'number') {
    return value; // Already in cents
  }
  
  return null;
}
