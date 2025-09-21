// Shared monetary interpretation rules for cents vs dollars

// Tables whose legacy (non-*_cents) money fields are stored in DOLLARS
export const LEGACY_DOLLARS_TABLES = new Set<string>([
  'invoices',
  'invoice_payments',
  'invoice_line_item_taxes',
  'invoice_template_line_items',
  'events',
  'invoice_entities',
  'programs',
  // 'payments' excluded: legacy numeric columns are INT4 cents in this schema
  'invoice_line_items',
  'payment_taxes',
]);

// Table.field exceptions where legacy field is numeric but stored in CENTS
export const LEGACY_CENTS_EXCEPTIONS = new Set<string>([
  'event_registrations.payment_amount',
]);

export function isLegacyDollars(table: string, field: string): boolean {
  if (LEGACY_CENTS_EXCEPTIONS.has(`${table}.${field}`)) return false;
  return LEGACY_DOLLARS_TABLES.has(table);
}

