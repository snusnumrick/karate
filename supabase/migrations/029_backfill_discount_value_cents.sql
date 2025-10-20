    -- Ensure discount_value_cents columns exist before backfilling (idempotent)
    ALTER TABLE public.discount_codes
      ADD COLUMN IF NOT EXISTS discount_value_cents INTEGER NOT NULL DEFAULT 0
      CHECK (discount_value_cents >= 0);

    ALTER TABLE public.discount_templates
      ADD COLUMN IF NOT EXISTS discount_value_cents INTEGER NOT NULL DEFAULT 0
      CHECK (discount_value_cents >= 0);

    -- Backfill discount_value_cents for existing discount codes and templates
    DO
    $$
    BEGIN
      -- Backfill discount_codes fixed amount values
      UPDATE public.discount_codes
      SET discount_value_cents = ROUND(discount_value * 100)
      WHERE discount_type = 'fixed_amount'
        AND (discount_value_cents IS NULL OR discount_value_cents = 0)
        AND COALESCE(discount_value, 0) <> 0;

      -- Ensure percentage discounts store zero in the cents column
      UPDATE public.discount_codes
      SET discount_value_cents = 0
      WHERE discount_type = 'percentage'
        AND discount_value_cents IS DISTINCT FROM 0;

      -- Backfill discount_templates fixed amount values
      UPDATE public.discount_templates
      SET discount_value_cents = ROUND(discount_value * 100)
      WHERE discount_type = 'fixed_amount'
        AND (discount_value_cents IS NULL OR discount_value_cents = 0)
        AND COALESCE(discount_value, 0) <> 0;

      -- Ensure percentage templates store zero in the cents column
      UPDATE public.discount_templates
      SET discount_value_cents = 0
      WHERE discount_type = 'percentage'
        AND discount_value_cents IS DISTINCT FROM 0;
    END;
    $$;
