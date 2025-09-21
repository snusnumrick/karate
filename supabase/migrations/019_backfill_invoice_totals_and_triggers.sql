-- Backfill invoice totals from line items and line-item taxes
-- Also add trigger-based maintenance to keep totals in sync

BEGIN;

-- 1) Helper function to (re)calculate totals for a single invoice
CREATE OR REPLACE FUNCTION public.recalc_invoice_totals(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS
$$
DECLARE
  v_subtotal_cents bigint := 0;
  v_discount_cents bigint := 0;
  v_tax_cents bigint := 0;
  v_total_cents bigint := 0;
  v_paid_cents bigint := 0;
BEGIN
  -- Subtotal and discounts from invoice_line_items
  SELECT
    COALESCE(SUM(COALESCE(ili.quantity, 1) * COALESCE(ili.unit_price_cents, ROUND(COALESCE(ili.unit_price, 0) * 100))), 0)::bigint AS subtotal_cents,
    COALESCE(SUM(COALESCE(ili.discount_amount_cents, ROUND(COALESCE(ili.discount_amount, 0) * 100))), 0)::bigint AS discount_cents
  INTO v_subtotal_cents, v_discount_cents
  FROM invoice_line_items AS ili
  WHERE ili.invoice_id = p_invoice_id;

  -- Total tax from invoice_line_item_taxes via line items
  SELECT
    COALESCE(SUM(COALESCE(ilt.tax_amount_cents, ROUND(COALESCE(ilt.tax_amount, 0) * 100))), 0)::bigint AS tax_cents
  INTO v_tax_cents
  FROM invoice_line_item_taxes AS ilt
  JOIN invoice_line_items AS ili
    ON ili.id = ilt.invoice_line_item_id
  WHERE ili.invoice_id = p_invoice_id;

  v_total_cents := v_subtotal_cents - v_discount_cents + v_tax_cents;

  -- Amount paid (if any) to compute amount_due
  SELECT COALESCE(inv.amount_paid_cents, 0)::bigint INTO v_paid_cents
  FROM invoices inv
  WHERE inv.id = p_invoice_id;

  -- Update invoice record with denormalized totals (both cents and legacy dollars)
  UPDATE invoices AS inv
  SET
    subtotal_cents        = v_subtotal_cents,
    subtotal              = (v_subtotal_cents / 100.0),
    discount_amount_cents = v_discount_cents,
    discount_amount       = (v_discount_cents / 100.0),
    tax_amount_cents      = v_tax_cents,
    tax_amount            = (v_tax_cents / 100.0),
    total_amount_cents    = v_total_cents,
    total_amount          = (v_total_cents / 100.0),
    amount_due_cents      = GREATEST(v_total_cents - v_paid_cents, 0),
    amount_due            = GREATEST(v_total_cents - v_paid_cents, 0) / 100.0,
    updated_at            = NOW()
  WHERE inv.id = p_invoice_id;
END;
$$;

-- 2) Triggers to keep totals in sync on line items changes
CREATE OR REPLACE FUNCTION public.trg_recalc_invoice_totals_from_line_items()
RETURNS trigger
LANGUAGE plpgsql AS
$$
BEGIN
  PERFORM public.recalc_invoice_totals(COALESCE(NEW.invoice_id, OLD.invoice_id));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_li_recalc_after_ins ON public.invoice_line_items;
DROP TRIGGER IF EXISTS trg_invoice_li_recalc_after_upd ON public.invoice_line_items;
DROP TRIGGER IF EXISTS trg_invoice_li_recalc_after_del ON public.invoice_line_items;

CREATE TRIGGER trg_invoice_li_recalc_after_ins
AFTER INSERT ON public.invoice_line_items
FOR EACH ROW EXECUTE PROCEDURE public.trg_recalc_invoice_totals_from_line_items();

CREATE TRIGGER trg_invoice_li_recalc_after_upd
AFTER UPDATE ON public.invoice_line_items
FOR EACH ROW EXECUTE PROCEDURE public.trg_recalc_invoice_totals_from_line_items();

CREATE TRIGGER trg_invoice_li_recalc_after_del
AFTER DELETE ON public.invoice_line_items
FOR EACH ROW EXECUTE PROCEDURE public.trg_recalc_invoice_totals_from_line_items();

-- 3) Triggers to keep totals in sync on line-item tax changes
CREATE OR REPLACE FUNCTION public.trg_recalc_invoice_totals_from_item_taxes()
RETURNS trigger
LANGUAGE plpgsql AS
$$
DECLARE
  v_invoice_id uuid;
BEGIN
  SELECT ili.invoice_id INTO v_invoice_id
  FROM invoice_line_items AS ili
  WHERE ili.id = COALESCE(NEW.invoice_line_item_id, OLD.invoice_line_item_id);

  IF v_invoice_id IS NOT NULL THEN
    PERFORM public.recalc_invoice_totals(v_invoice_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_ilt_recalc_after_ins ON public.invoice_line_item_taxes;
DROP TRIGGER IF EXISTS trg_invoice_ilt_recalc_after_upd ON public.invoice_line_item_taxes;
DROP TRIGGER IF EXISTS trg_invoice_ilt_recalc_after_del ON public.invoice_line_item_taxes;

CREATE TRIGGER trg_invoice_ilt_recalc_after_ins
AFTER INSERT ON public.invoice_line_item_taxes
FOR EACH ROW EXECUTE PROCEDURE public.trg_recalc_invoice_totals_from_item_taxes();

CREATE TRIGGER trg_invoice_ilt_recalc_after_upd
AFTER UPDATE ON public.invoice_line_item_taxes
FOR EACH ROW EXECUTE PROCEDURE public.trg_recalc_invoice_totals_from_item_taxes();

CREATE TRIGGER trg_invoice_ilt_recalc_after_del
AFTER DELETE ON public.invoice_line_item_taxes
FOR EACH ROW EXECUTE PROCEDURE public.trg_recalc_invoice_totals_from_item_taxes();

-- 4) One-time backfill for all existing invoices
WITH li AS (
  SELECT
    ili.invoice_id,
    COALESCE(SUM(COALESCE(ili.quantity, 1) * COALESCE(ili.unit_price_cents, ROUND(COALESCE(ili.unit_price, 0) * 100))), 0)::bigint AS subtotal_cents,
    COALESCE(SUM(COALESCE(ili.discount_amount_cents, ROUND(COALESCE(ili.discount_amount, 0) * 100))), 0)::bigint AS discount_cents
  FROM public.invoice_line_items AS ili
  GROUP BY ili.invoice_id
),
tax AS (
  SELECT
    ili.invoice_id,
    COALESCE(SUM(COALESCE(ilt.tax_amount_cents, ROUND(COALESCE(ilt.tax_amount, 0) * 100))), 0)::bigint AS tax_cents
  FROM public.invoice_line_items AS ili
  JOIN public.invoice_line_item_taxes AS ilt
    ON ilt.invoice_line_item_id = ili.id
  GROUP BY ili.invoice_id
),
agg AS (
  SELECT
    i.id AS invoice_id,
    COALESCE(li.subtotal_cents, 0) AS subtotal_cents,
    COALESCE(li.discount_cents, 0) AS discount_cents,
    COALESCE(tax.tax_cents, 0) AS tax_cents
  FROM public.invoices AS i
  LEFT JOIN li  ON li.invoice_id  = i.id
  LEFT JOIN tax ON tax.invoice_id = i.id
)
UPDATE public.invoices AS inv
SET
  subtotal_cents        = agg.subtotal_cents,
  subtotal              = (agg.subtotal_cents / 100.0),
  discount_amount_cents = agg.discount_cents,
  discount_amount       = (agg.discount_cents / 100.0),
  tax_amount_cents      = agg.tax_cents,
  tax_amount            = (agg.tax_cents / 100.0),
  total_amount_cents    = (agg.subtotal_cents - agg.discount_cents + agg.tax_cents),
  total_amount          = ((agg.subtotal_cents - agg.discount_cents + agg.tax_cents) / 100.0),
  amount_due_cents      = GREATEST((agg.subtotal_cents - agg.discount_cents + agg.tax_cents) - COALESCE(inv.amount_paid_cents, 0), 0),
  amount_due            = GREATEST((agg.subtotal_cents - agg.discount_cents + agg.tax_cents) - COALESCE(inv.amount_paid_cents, 0), 0) / 100.0
FROM agg
WHERE inv.id = agg.invoice_id;

COMMIT;

