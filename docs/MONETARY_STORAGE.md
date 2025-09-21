# Monetary Storage Documentation

## Developer Cheatsheet

- Read (prefer cents; fallback to legacy by table rules)
  - Centralized helpers (preferred):
    - `import { moneyFromRow, centsFromRow } from '~/services/database-money.server'`
    - `const total = moneyFromRow('invoices', 'total_amount', invoiceRow)` // Money
    - `const taxCents = centsFromRow('payment_taxes', 'tax_amount', taxRow)` // number (cents)
    - These honor table-level rules (e.g., payments legacy int4 cents vs invoice_payments legacy dollars) and `_cents` precedence.
  - Legacy generic helpers (still available):
    - `import { moneyFromDb, centsFromDb } from '~/utils/db-money'`
    - Use only when table context is unavailable; prefer the centralized helpers above.
  - Special case: `event_registrations.payment_amount` legacy numeric is cents, not dollars.

- Write (during migration, update both)
  - Store cents in `*_cents` and dollars in legacy numeric:
    - Payments (subtotal/total):
      - `subtotal_amount_cents = money.getAmount()`; `subtotal_amount = money.getAmount() / 100`
      - `total_amount_cents = money.getAmount()`; `total_amount = money.getAmount() / 100`
    - Line item taxes / payment taxes:
      - `tax_amount_cents = money.getAmount()`; `tax_amount = money.getAmount() / 100`

- Query/Filter
  - Prefer `*_cents` columns in filters, e.g. `gte('total_amount_cents', minCents)`; when unavailable, convert dollars to cents client‑side for comparisons.

- Display
  - Use `formatMoney(moneyFromDb(row, 'amount_cents', 'amount'))`

Short examples

```ts
// Read totals from invoices
const total = moneyFromDb(invoiceRow, 'total_amount_cents', 'total_amount');
const paid = moneyFromDb(invoiceRow, 'amount_paid_cents', 'amount_paid');

// Read taxes from payment_taxes
const tax = moneyFromDb(taxRow, 'tax_amount_cents', 'tax_amount');

// Write a payment
await supabase.from('payments').insert({
  family_id,
  subtotal_amount: sub.getAmount() / 100,
  subtotal_amount_cents: sub.getAmount(),
  total_amount: total.getAmount() / 100,
  total_amount_cents: total.getAmount(),
});

// Write a line item tax
await supabase.from('invoice_line_item_taxes').insert({
  invoice_line_item_id: lineItemId,
  tax_rate_id,
  tax_amount: tax.getAmount() / 100,
  tax_amount_cents: tax.getAmount(),
});
```

This document lists all database tables and how monetary values are stored in each table.

## Storage Format Legend
- **Cents (INT4)**: Values stored as integers representing cent amounts (e.g., 2599 for $25.99) - **STANDARD FORMAT**
- **Dollars (DECIMAL)**: Legacy values stored as decimal numbers representing dollar amounts (e.g., 25.99) - **DEPRECATED**

## Migration Status

We are migrating to INT4 cents columns (`*_cents`) across the schema. During migration, legacy numeric (DECIMAL) columns continue to exist and must be interpreted consistently:

- New standard columns: `*_cents` (INT4) store amounts in cents.
- Legacy numeric (DECIMAL) columns: store amounts in dollars for most tables.
- Exception: `event_registrations.payment_amount` is legacy numeric but stores cents.
- Client behavior during migration:
  - Prefer reading from `*_cents` columns when present.
  - When `*_cents` is missing, treat legacy numeric values as dollars (except the noted cents exception).
  - On writes, update both the legacy numeric column (in dollars) and the `*_cents` column (in cents).

## Tables with Monetary Fields

### discount_codes
- `discount_value_cents`: INT4 cents
- `discount_value` (legacy numeric): Special — represents either a fixed-amount discount in dollars or a percentage rate. Keep as numeric; do not coerce to cents.

### event_registrations
- `payment_amount_cents`: INT4 cents
- `payment_amount` (legacy numeric): Stores cents (exception to the general dollars rule).

### events
- `registration_fee_cents`, `late_registration_fee_cents`: INT4 cents
- `registration_fee`, `late_registration_fee` (legacy numeric): Dollars

### event_registrations -> **Cents (INT4)**
- `payment_amount_cents`: Stored in cents
- ~~`payment_amount`~~: Legacy DECIMAL column (deprecated)

### invoice_entities
- `credit_limit_cents`: INT4 cents
- `credit_limit` (legacy numeric): Dollars

### invoice_line_items
- `unit_price_cents`, `line_total_cents`, `tax_amount_cents`, `discount_amount_cents`: INT4 cents
- `unit_price`, `line_total`, `tax_amount`, `discount_amount` (legacy numeric): Dollars

### invoice_line_item_taxes
- `tax_amount_cents`: INT4 cents
- `tax_amount` (legacy numeric): Dollars

View: `invoice_line_item_tax_breakdown` reflects the same semantics (numeric amounts are dollars).

### invoice_payments
- `amount_cents`: INT4 cents
- `amount` (legacy numeric): Dollars

### invoice_templates
- `unit_price_cents`: INT4 cents
- `unit_price` (legacy numeric): Dollars

### invoices
- `subtotal_cents`, `tax_amount_cents`, `discount_amount_cents`, `total_amount_cents`, `amount_paid_cents`, `amount_due_cents`: INT4 cents
- `subtotal`, `tax_amount`, `discount_amount`, `total_amount`, `amount_paid`, `amount_due` (legacy numeric): Dollars

### order_items -> **Cents (INT4)**
- `price_per_item_cents`: Stored in cents

### orders -> **Cents (INT4)**
- `total_amount_cents`: Stored in cents

### payment_taxes
- `tax_amount_cents`: INT4 cents
- `tax_amount` (legacy numeric): Dollars

### payments
- `subtotal_amount_cents`, `total_amount_cents`: INT4 cents
- `subtotal_amount`, `total_amount`, `discount_amount` (legacy numeric): Dollars

### product_variants -> **Cents (INT4)**
- `price_in_cents`: Stored in cents

### programs
- If present in your schema:
  - `*_fee_cents`: INT4 cents
  - `*_fee` (legacy numeric): Dollars

### tax_rates -> **Percentage (DECIMAL)**
- `rate`: Stored as decimal percentage (e.g., 0.08 for 8%) - **Not monetary, no change needed**

## Summary

### Tables storing amounts in **Cents (INT4)** - STANDARD:
- discount_codes (discount_value_cents)
- events (registration_fee_cents, late_registration_fee_cents)
- event_registrations (payment_amount_cents)
- invoice_entities (credit_limit_cents)
- invoice_line_items (unit_price_cents, line_total_cents, tax_amount_cents, discount_amount_cents)
- invoice_line_item_taxes (tax_amount_cents)
- invoice_payments (amount_cents)
- invoice_templates (unit_price_cents)
- invoices (subtotal_cents, tax_amount_cents, discount_amount_cents, total_amount_cents, amount_paid_cents, amount_due_cents)
- order_items (price_per_item_cents)
- orders (total_amount_cents)
- payment_taxes (tax_amount_cents)
- payments (subtotal_amount_cents, total_amount_cents)
- product_variants (price_in_cents)
- programs (`*_fee_cents`, if present)

### Legacy DECIMAL columns (during migration):
- Legacy numeric values are interpreted as dollars, except `event_registrations.payment_amount` (cents).
- Write both legacy (dollars) and `*_cents` (cents) during the migration window.

## Important Notes

1. **Standardized Storage**: All monetary values are now stored as INT4 cents for consistency and precision
2. **Legacy Columns**: DECIMAL columns are deprecated but maintained temporarily for rollback safety
3. **Application Layer**: The `money.ts` utility handles conversion between cents (storage) and dollars (display)
4. **Tax Rates**: Stored as decimal percentages (e.g., 0.08 for 8%) - not monetary values
5. **Migration Safety**: Both old and new columns exist during transition period

## Migration History

### Phase 1: dinero.js Integration (Completed)
- Integrated dinero.js library for type-safe monetary operations
- Updated `formatCurrency` function to handle both legacy numbers and dinero objects
- Created comprehensive money utility functions

### Phase 2: Database Standardization (Migration 015)
- Added INT4 cents columns to all tables with monetary fields
- Migrated existing DECIMAL data to new INT4 cents columns
- Added indexes for performance on frequently queried monetary fields
- Maintained legacy columns for rollback safety

### Phase 3: Application Migration (In Progress)
- Update all database queries to use new `_cents` columns
- Remove references to legacy DECIMAL columns
- Update TypeScript types to reflect new schema

### Phase 4: Cleanup (Future)
- Drop legacy DECIMAL columns after confirming application stability
- Update database constraints and relationships

## Development Guidelines

### For New Code:
- **ALWAYS** use `_cents` columns for monetary fields
- Use `money.ts` utilities for creating and manipulating monetary values
- Store amounts as integers in cents (multiply dollars by 100)
- Use `formatCurrency()` or `formatMoney()` for display

### For Existing Code:
- Gradually migrate queries from DECIMAL to INT4 cents columns
- Test thoroughly when switching column references
- Use `migrateDollarAmount()` helper for legacy data conversion

### Database Queries:
```sql
-- ✅ CORRECT - Use cents columns
SELECT total_amount_cents FROM invoices WHERE id = $1;

-- ❌ INCORRECT - Don't use legacy columns
SELECT total_amount FROM invoices WHERE id = $1;
```

### TypeScript Code:
```typescript
// ✅ CORRECT - Use money utilities
import { createMoney, formatMoney } from '~/utils/money';
const price = createMoney(1299, true); // 1299 cents = $12.99

// ❌ INCORRECT - Don't manipulate cents directly
const price = 1299 / 100; // Loses type safety
```
