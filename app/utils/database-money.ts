import { fromCents, type Money } from '~/utils/money';
import { isLegacyDollars } from '~/utils/money-rules';
import { getNum } from '~/utils/db-money';

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
