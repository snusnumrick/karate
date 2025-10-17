-- Karate School Database Setup
-- Run this in your Supabase SQL Editor
-- This script is idempotent - safe to run multiple times without duplicating data
--
-- IMPORTANT: Monetary fields have been migrated to INT4 cents storage for precision and consistency.
-- See migration 015_convert_decimal_to_int4_cents.sql and 018_migrate_discount_value_to_cents.sql.
-- See MONETARY_STORAGE.md for complete documentation.
-- All monetary amounts are stored as integers representing cents (e.g., $12.34 = 1234 cents).
-- Note: discount_codes and discount_templates tables now use discount_value_cents (INT4) instead of discount_value (NUMERIC).

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Create or modify payment_status enum
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
            CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed'); -- Changed 'completed' to 'succeeded'
        END IF;
    END
$$;

-- Create belt_rank enum type if it doesn't exist
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'belt_rank_enum') THEN
            CREATE TYPE belt_rank_enum AS ENUM (
                'white',
                'yellow',
                'orange',
                'green',
                'blue',
                'purple',
                'red', -- Assuming red is between purple and brown based on /classes page
                'brown',
                'black'
                -- Add Dan ranks if needed, e.g., 'black_1st_dan', 'black_2nd_dan'
                );
        END IF;
    END
$$;

-- Create order_status enum type if it doesn't exist
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
            CREATE TYPE public.order_status AS ENUM (
                'pending_payment', -- Order created, waiting for payment completion
                'paid_pending_pickup', -- Payment successful, ready for pickup
                'completed', -- Order picked up
                'cancelled' -- Order cancelled (e.g., payment failed, admin action)
                );
        END IF;
    END
$$;

-- Create profile role enum (user, instructor, admin)
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'profile_role') THEN
            CREATE TYPE profile_role AS ENUM ('user', 'instructor', 'admin');
        END IF;
    END
$$;


-- Create payment_type enum type if it doesn't exist
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_type_enum') THEN
            CREATE TYPE public.payment_type_enum AS ENUM (
                'monthly_group',
                'yearly_group',
                'individual_session',
                -- 'store_purchase', -- Value will be added below if needed
                -- 'event_registration', -- Value will be added below if needed
                'other'
                );
        END IF;
    END
$$;

-- Add 'store_purchase' value to the enum if it doesn't already exist
-- This handles the case where the enum exists but is missing the value
DO
$$
    BEGIN
        ALTER TYPE public.payment_type_enum ADD VALUE IF NOT EXISTS 'store_purchase';
    EXCEPTION
        WHEN duplicate_object THEN -- Handle potential race condition if run concurrently
            RAISE NOTICE 'Value "store_purchase" already exists in enum payment_type_enum.';
    END
$$;

-- Add 'event_registration' value to the enum if it doesn't already exist
-- This handles the case where the enum exists but is missing the value
DO
$$
    BEGIN
        ALTER TYPE public.payment_type_enum ADD VALUE IF NOT EXISTS 'event_registration';
    EXCEPTION
        WHEN duplicate_object THEN -- Handle potential race condition if run concurrently
            RAISE NOTICE 'Value "event_registration" already exists in enum payment_type_enum.';
    END
$$;

-- Create enum for days of the week
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'day_of_week') THEN
            CREATE TYPE day_of_week AS ENUM (
                'monday',
                'tuesday', 
                'wednesday',
                'thursday',
                'friday',
                'saturday',
                'sunday'
            );
        END IF;
    END
$$;

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Shared helper for BEFORE UPDATE triggers that maintain updated_at
CREATE OR REPLACE FUNCTION public.update_modified_column()
    RETURNS TRIGGER AS
$$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create entity_type enum for invoice entities
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entity_type_enum') THEN
            CREATE TYPE entity_type_enum AS ENUM (
                'family',
                'school',
                'government',
                'corporate',
                'other'
            );
        END IF;
    END
$$;

-- Create t_shirt_size enum type if it doesn't exist
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 't_shirt_size_enum') THEN
            CREATE TYPE t_shirt_size_enum AS ENUM (
                'YXXS',
                'YXS',
                'YS',
                'YM',
                'YL',
                'YXL',
                'AS',
                'AM',
                'AL',
                'AXL',
                'A2XL'
            );
        END IF;
    END
$$;

-- Migrate existing t_shirt_size data from text to enum
DO
$$
    BEGIN
        -- Check if the column is still text type
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'students' 
                  AND column_name = 't_shirt_size' 
                  AND data_type = 'text') THEN
            
            -- First, update any invalid values to valid enum values
            UPDATE students SET t_shirt_size = 'YXS' WHERE t_shirt_size NOT IN ('YXXS', 'YXS', 'YS', 'YM', 'YL', 'YXL', 'AS', 'AM', 'AL', 'AXL', 'A2XL');
            
            -- Add a temporary column with the enum type
            ALTER TABLE students ADD COLUMN t_shirt_size_temp t_shirt_size_enum;
            
            -- Copy data from text column to enum column with explicit casting
            UPDATE students SET t_shirt_size_temp = 
                CASE t_shirt_size
                    WHEN 'YXXS' THEN 'YXXS'::t_shirt_size_enum
                    WHEN 'YXS' THEN 'YXS'::t_shirt_size_enum
                    WHEN 'YS' THEN 'YS'::t_shirt_size_enum
                    WHEN 'YM' THEN 'YM'::t_shirt_size_enum
                    WHEN 'YL' THEN 'YL'::t_shirt_size_enum
                    WHEN 'YXL' THEN 'YXL'::t_shirt_size_enum
                    WHEN 'AS' THEN 'AS'::t_shirt_size_enum
                    WHEN 'AM' THEN 'AM'::t_shirt_size_enum
                    WHEN 'AL' THEN 'AL'::t_shirt_size_enum
                    WHEN 'AXL' THEN 'AXL'::t_shirt_size_enum
                    WHEN 'A2XL' THEN 'A2XL'::t_shirt_size_enum
                    ELSE 'YXS'::t_shirt_size_enum
                END;
            
            -- Drop the old text column
            ALTER TABLE students DROP COLUMN t_shirt_size;
            
            -- Rename the temp column to the original name
            ALTER TABLE students RENAME COLUMN t_shirt_size_temp TO t_shirt_size;
            
            -- Add NOT NULL constraint
            ALTER TABLE students ALTER COLUMN t_shirt_size SET NOT NULL;
        END IF;
    END
$$;


-- Create tables with IF NOT EXISTS to avoid errors on subsequent runs

-- Families table
CREATE TABLE IF NOT EXISTS families
(
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name              text        NOT NULL,
    address           text        NOT NULL,
    city              text        NOT NULL,
    province          text        NOT NULL,
    postal_code       varchar(10) NOT NULL,
    primary_phone     varchar(20) NOT NULL,
    email             text        NOT NULL,
    referral_source   text,
    referral_name     text,
    emergency_contact text,
    health_info       text,
    created_at        timestamptz      DEFAULT now(),
    updated_at        timestamptz      DEFAULT now()
);

-- Example: Add a column to an existing table idempotently
ALTER TABLE families
    ADD COLUMN IF NOT EXISTS notes text;

-- Add columns for registration waiver tracking
ALTER TABLE families
    ADD COLUMN IF NOT EXISTS registration_waivers_complete boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS registration_waivers_completed_at timestamptz;


-- Guardians table
CREATE TABLE IF NOT EXISTS guardians
(
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id      uuid REFERENCES families (id) ON DELETE CASCADE NOT NULL,
    first_name     text                                            NOT NULL,
    last_name      text                                            NOT NULL,
    relationship   text                                            NOT NULL,
    home_phone     varchar(20),
    work_phone     varchar(20),
    cell_phone     varchar(20)                                     NOT NULL,
    email          text                                            NOT NULL,
    employer       text,
    employer_phone varchar(20),
    employer_notes text
);

-- Create indexes if they don't exist
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1
                       FROM pg_indexes
                       WHERE indexname = 'idx_guardians_family_id') THEN
            CREATE INDEX idx_guardians_family_id ON guardians (family_id);
        END IF;
    END
$$;

-- Students table
CREATE TABLE IF NOT EXISTS students
(
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id                uuid REFERENCES families (id) ON DELETE CASCADE NOT NULL,
    first_name               text                                            NOT NULL,
    last_name                text                                            NOT NULL,
    gender                   text                                            NOT NULL,
    birth_date               date                                            NOT NULL,
    -- belt_rank removed, derive from latest belt_awards
    t_shirt_size             text                                            NOT NULL,
    school                   text                                            NOT NULL,
    grade_level              text,
    cell_phone               varchar(20),
    email                    text,
    height                   integer,                                        -- Height in centimeters (optional)
    immunizations_up_to_date text,
    immunization_notes       text,
    allergies                text,
    medications              text,
    special_needs            text
);

DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1
                       FROM pg_indexes
                       WHERE indexname = 'idx_students_family_id') THEN
            CREATE INDEX idx_students_family_id ON students (family_id);
        END IF;
    END
$$;


-- Profiles table (must exist before downstream RLS policies reference it)
CREATE TABLE IF NOT EXISTS public.profiles
(
    id         uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    email      text NOT NULL,
    role       profile_role NOT NULL DEFAULT 'user'::profile_role,
    family_id  uuid REFERENCES families (id) ON DELETE SET NULL,
    first_name text NULL,
    last_name  text NULL
);

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS first_name text NULL;
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS last_name text NULL;
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES families (id) ON DELETE SET NULL;

DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1
                   FROM pg_indexes
                   WHERE indexname = 'idx_profiles_family_id') THEN
        CREATE INDEX idx_profiles_family_id ON public.profiles (family_id);
    END IF;
END
$$;

-- Ensure profiles.role uses profile_role enum even if pre-existing
DO
$$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'profiles'
          AND column_name = 'role'
          AND udt_name <> 'profile_role'
    ) THEN
        ALTER TABLE public.profiles
            ADD COLUMN IF NOT EXISTS role_tmp profile_role DEFAULT 'user'::profile_role;

        UPDATE public.profiles
        SET role_tmp = COALESCE(NULLIF(trim(role::text), ''), 'user')::profile_role;

        ALTER TABLE public.profiles
            ALTER COLUMN role_tmp SET NOT NULL;

        ALTER TABLE public.profiles
            DROP COLUMN role;

        ALTER TABLE public.profiles
            RENAME COLUMN role_tmp TO role;
    END IF;
END
$$;


-- --- Store Related Tables ---

-- Products Table (e.g., Gi, T-Shirt)
CREATE TABLE IF NOT EXISTS public.products
(
    id          uuid                     DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name        text                                               NOT NULL UNIQUE,
    description text                                               NULL,
    image_url   text                                               NULL,                  -- URL to image in Supabase Storage
    is_active   boolean                                            NOT NULL DEFAULT true, -- To show/hide product
    created_at  timestamp with time zone DEFAULT now()             NOT NULL,
    updated_at  timestamp with time zone DEFAULT now()             NOT NULL
);

-- Enable RLS for products
ALTER TABLE public.products
    ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products
DO
$$
    BEGIN
        -- Allow authenticated users to view active products
        IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow authenticated users to view active products'
                         AND tablename = 'products') THEN
            CREATE POLICY "Allow authenticated users to view active products" ON public.products
                FOR SELECT TO authenticated USING (is_active = true);
        END IF;
        -- Allow admins to manage products
        IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage products'
                         AND tablename = 'products') THEN
            CREATE POLICY "Allow admins to manage products" ON public.products
                FOR ALL USING (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
                ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
                );
        END IF;
    END
$$;

-- Add update timestamp trigger for products table
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'products_updated') THEN
            CREATE TRIGGER products_updated
                BEFORE UPDATE
                ON public.products
                FOR EACH ROW
            EXECUTE FUNCTION public.update_modified_column();
        END IF;
    END
$$;


-- Product Variants Table (Handles Size, Price, Stock)
CREATE TABLE IF NOT EXISTS public.product_variants
(
    id             uuid                     DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    product_id     uuid                                               NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
    size           text                                               NOT NULL,              -- e.g., 'YM', 'AS', 'Size 3', '120cm'
    price_in_cents integer                                            NOT NULL CHECK (price_in_cents >= 0),
    stock_quantity integer                                            NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    is_active      boolean                                            NOT NULL DEFAULT true, -- To show/hide specific variant/size
    created_at     timestamp with time zone DEFAULT now()             NOT NULL,
    updated_at     timestamp with time zone DEFAULT now()             NOT NULL,
    CONSTRAINT unique_product_size UNIQUE (product_id, size)                                 -- Ensure only one entry per product/size
);

-- Add indexes
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_product_variants_product_id') THEN
            CREATE INDEX idx_product_variants_product_id ON public.product_variants (product_id);
        END IF;
    END
$$;

-- Enable RLS for product_variants
ALTER TABLE public.product_variants
    ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_variants
DO
$$
    BEGIN
        -- Allow authenticated users to view active variants of active products
        IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow authenticated users to view active variants'
                         AND tablename = 'product_variants') THEN
            CREATE POLICY "Allow authenticated users to view active variants" ON public.product_variants
                FOR SELECT TO authenticated USING (
                product_variants.is_active = true AND
                EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.is_active = true)
                );
        END IF;
        -- Allow admins to manage variants
        IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage product variants'
                         AND tablename = 'product_variants') THEN
            CREATE POLICY "Allow admins to manage product variants" ON public.product_variants
                FOR ALL USING (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
                ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
                );
        END IF;
    END
$$;

-- Add update timestamp trigger for product_variants table
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'product_variants_updated') THEN
            CREATE TRIGGER product_variants_updated
                BEFORE UPDATE
                ON public.product_variants
                FOR EACH ROW
            EXECUTE FUNCTION public.update_modified_column();
        END IF;
    END
$$;


-- Orders Table
CREATE TABLE IF NOT EXISTS public.orders
(
    id                 uuid                     DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    family_id          uuid                                               NOT NULL REFERENCES public.families (id) ON DELETE RESTRICT, -- Don't delete family if orders exist
    student_id         uuid                                               NULL REFERENCES public.students (id) ON DELETE SET NULL,     -- Optional: Link to specific student
    order_date         timestamp with time zone DEFAULT now()             NOT NULL,
    total_amount_cents integer                                            NOT NULL CHECK (total_amount_cents >= 0),                    -- Total including taxes, matches payment total
    status             public.order_status                                NOT NULL DEFAULT 'pending_payment',
    pickup_notes       text                                               NULL,                                                        -- Notes for admin regarding pickup
    created_at         timestamp with time zone DEFAULT now()             NOT NULL,
    updated_at         timestamp with time zone DEFAULT now()             NOT NULL
);

-- Add indexes
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_family_id') THEN
            CREATE INDEX idx_orders_family_id ON public.orders (family_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_student_id') THEN
            CREATE INDEX idx_orders_student_id ON public.orders (student_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_orders_status') THEN
            CREATE INDEX idx_orders_status ON public.orders (status);
        END IF;
    END
$$;

-- Enable RLS for orders
ALTER TABLE public.orders
    ENABLE ROW LEVEL SECURITY;

-- RLS Policies for orders
DO
$$
    BEGIN
        -- Allow family members to view their own orders
        IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow family members to view their orders'
                         AND tablename = 'orders') THEN
            CREATE POLICY "Allow family members to view their orders" ON public.orders
                FOR SELECT USING (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.family_id = orders.family_id)
                );
        END IF;
        -- Allow admins to manage all orders
        IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage orders'
                         AND tablename = 'orders') THEN
            CREATE POLICY "Allow admins to manage orders" ON public.orders
                FOR ALL USING (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
                ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
                );
        END IF;
    END
$$;

-- Add update timestamp trigger for orders table
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'orders_updated') THEN
            CREATE TRIGGER orders_updated
                BEFORE UPDATE
                ON public.orders
                FOR EACH ROW
            EXECUTE FUNCTION public.update_modified_column();
        END IF;
    END
$$;


-- Order Items Table (Junction between Orders and Product Variants)
CREATE TABLE IF NOT EXISTS public.order_items
(
    id                   uuid                     DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    order_id             uuid                                               NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
    product_variant_id   uuid                                               NOT NULL REFERENCES public.product_variants (id) ON DELETE RESTRICT, -- Don't delete variant if ordered
    quantity             integer                                            NOT NULL CHECK (quantity > 0),
    price_per_item_cents integer                                            NOT NULL CHECK (price_per_item_cents >= 0),                          -- Price at the time of order
    created_at           timestamp with time zone DEFAULT now()             NOT NULL
    -- No updated_at needed here usually
);

-- Add indexes
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_order_items_order_id') THEN
            CREATE INDEX idx_order_items_order_id ON public.order_items (order_id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_order_items_product_variant_id') THEN
            CREATE INDEX idx_order_items_product_variant_id ON public.order_items (product_variant_id);
        END IF;
    END
$$;

-- Enable RLS for order_items
ALTER TABLE public.order_items
    ENABLE ROW LEVEL SECURITY;

-- RLS Policies for order_items
DO
$$
    BEGIN
        -- Allow family members to view items belonging to their orders
        IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow family members to view their order items'
                         AND tablename = 'order_items') THEN
            CREATE POLICY "Allow family members to view their order items" ON public.order_items
                FOR SELECT USING (
                EXISTS (SELECT 1
                        FROM public.orders o
                                 JOIN public.profiles p ON o.family_id = p.family_id
                        WHERE order_items.order_id = o.id
                          AND p.id = auth.uid())
                );
        END IF;
        -- Allow admins to manage all order items
        IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage order items'
                         AND tablename = 'order_items') THEN
            CREATE POLICY "Allow admins to manage order items" ON public.order_items
                FOR ALL USING (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
                ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
                );
        END IF;
    END
$$;

-- --- End Store Related Tables ---


-- Payments table
CREATE TABLE IF NOT EXISTS payments
(
    id                uuid PRIMARY KEY                                         DEFAULT gen_random_uuid(),
    family_id         uuid REFERENCES families (id) ON DELETE CASCADE NOT NULL,
    -- Replace 'amount' with subtotal, tax, and total (store in cents as integers)
    subtotal_amount   integer                                         NOT NULL CHECK (subtotal_amount >= 0),
    -- tax_amount removed, will be stored in payment_taxes junction table
    total_amount      integer                                         NOT NULL CHECK (total_amount >= 0), -- Now subtotal + sum of payment_taxes
    payment_date      date                                            NULL,                               -- Set on successful completion
    payment_method    text                                            NULL,                               -- Method might be determined by Stripe/provider
    status            payment_status                                  NOT NULL DEFAULT 'pending',
    stripe_session_id text                                            NULL,                               -- Added for Stripe integration
    receipt_url       text                                            NULL,                               -- Added for Stripe integration
    card_last4        text                                            NULL                                -- Added for card last 4 digits display,
);

-- Add columns idempotently if table already exists
-- Add subtotal and total columns (integers for cents) if they don't exist
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS subtotal_amount integer NULL CHECK (subtotal_amount >= 0);
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS total_amount integer NULL CHECK (total_amount >= 0);

-- Drop the old single tax_amount column if it exists
ALTER TABLE payments
    DROP COLUMN IF EXISTS tax_amount;

-- Drop the old numeric amount column if it exists (kept from previous state)
ALTER TABLE payments
    DROP COLUMN IF EXISTS amount;

-- Add other columns idempotently
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS stripe_session_id text NULL; -- Keep for potential legacy data or other flows
-- Rename stripe_payment_intent_id to generic payment_intent_id for all providers
ALTER TABLE payments 
    ADD COLUMN IF NOT EXISTS payment_intent_id text NULL; -- Generic payment intent ID for all providers

-- Copy data from old column if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payments'
          AND column_name = 'stripe_payment_intent_id'
    ) THEN
        EXECUTE 'UPDATE public.payments
                 SET payment_intent_id = stripe_payment_intent_id
                 WHERE stripe_payment_intent_id IS NOT NULL
                   AND payment_intent_id IS NULL';
    END IF;
END $$;

-- Remove old Stripe-specific column
ALTER TABLE payments DROP COLUMN IF EXISTS stripe_payment_intent_id;
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS receipt_url text NULL;
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS card_last4 text NULL;
-- Add card_last4 column

-- Modify existing columns to be nullable if needed (optional, depends on if script was run before)
ALTER TABLE payments
    ALTER COLUMN payment_date DROP NOT NULL; -- Make payment_date nullable
ALTER TABLE payments
    ALTER COLUMN payment_method DROP NOT NULL;
-- Make payment_method nullable

-- Add payment type column idempotently
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS type public.payment_type_enum DEFAULT 'monthly_group';

-- Add notes column idempotently
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add timestamp columns idempotently
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add order_id column idempotently (link to the new orders table)
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS order_id uuid NULL REFERENCES public.orders (id) ON DELETE SET NULL;
-- Allow null, set null if order deleted

-- Make type column non-nullable (only if it exists and is currently nullable)
-- This assumes the ADD COLUMN above succeeded or it already existed.
-- We check if it's nullable before trying to set NOT NULL.
DO
$$
    BEGIN
        IF EXISTS (SELECT 1
                   FROM information_schema.columns
                   WHERE table_schema = 'public'
                     AND table_name = 'payments'
                     AND column_name = 'type'
                     AND is_nullable = 'YES') THEN
            ALTER TABLE public.payments
                ALTER COLUMN type SET NOT NULL;
        END IF;
    END
$$;


DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1
                       FROM pg_indexes
                       WHERE indexname = 'idx_payments_family_id') THEN
            CREATE INDEX idx_payments_family_id ON payments (family_id);
        END IF;
    END
$$;

-- Add update timestamp trigger for payments table
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1
                       FROM pg_trigger
                       WHERE tgname = 'payments_updated') THEN
            CREATE TRIGGER payments_updated
                BEFORE UPDATE
                ON payments
                FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
        END IF;
    END
$$;

-- Payment-Students junction table
CREATE TABLE IF NOT EXISTS payment_students
(
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id uuid REFERENCES payments (id) ON DELETE CASCADE NOT NULL,
    student_id uuid REFERENCES students (id) ON DELETE CASCADE NOT NULL
);

DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_students_payment_id') THEN
            CREATE INDEX idx_payment_students_payment_id ON payment_students (payment_id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_students_student_id') THEN
            CREATE INDEX idx_payment_students_student_id ON payment_students (student_id);
        END IF;
    END
$$;

-- Belt Awards table (Renamed from Achievements)
CREATE TABLE IF NOT EXISTS belt_awards
(
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id   uuid REFERENCES students (id) ON DELETE CASCADE NOT NULL,
    type         belt_rank_enum                                  NOT NULL, -- Changed from text to enum
    description  text                                            NULL,     -- Explicitly allow NULL
    awarded_date date                                            NOT NULL
);

-- Alter existing table column to allow NULL if it was previously NOT NULL
ALTER TABLE belt_awards
    ALTER COLUMN description DROP NOT NULL;

-- Alter existing table column type if script was run before enum creation
-- This might fail if existing data in 'type' cannot be cast to the enum.
-- Manual data cleanup might be needed before running this alter statement.
-- IMPORTANT: Before running this, ensure no rows in 'belt_awards' have an empty string ('') for 'type'. Update them to a valid enum value (e.g., 'white').
-- Consider running this manually after data check if needed:
-- ALTER TABLE belt_awards ALTER COLUMN type TYPE belt_rank_enum USING type::belt_rank_enum;

DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1
                       FROM pg_indexes
                       WHERE indexname = 'idx_belt_awards_student_id' -- Renamed index
        ) THEN
            CREATE INDEX idx_belt_awards_student_id ON belt_awards (student_id); -- Renamed index and table
        END IF;
    END
$$;

-- Waivers table
CREATE TABLE IF NOT EXISTS waivers
(
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title       text    NOT NULL,
    description text    NOT NULL,
    content     text    NOT NULL,
    required    boolean NOT NULL DEFAULT false,
    required_for_registration boolean DEFAULT false,
    required_for_trial boolean DEFAULT false,
    CONSTRAINT waivers_title_unique UNIQUE (title) -- Ensure title is unique for ON CONFLICT
);

-- Ensure the unique constraint exists even if the table was created previously without it
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1
                       FROM pg_constraint
                       WHERE conname = 'waivers_title_unique'
                         AND conrelid = 'public.waivers'::regclass) THEN
            ALTER TABLE public.waivers
                ADD CONSTRAINT waivers_title_unique UNIQUE (title);
        END IF;
    END;
$$;

-- Insert standard waivers (Use ON CONFLICT to make idempotent)
-- IMPORTANT: Replace placeholder content with legally reviewed text for BC.
INSERT INTO waivers (title, description, content, required)
VALUES ('Liability Release', 'Acknowledgement of Risks and Release of Liability',
        E'I understand that participation in all KARATE GREENEGIN''s karate training, classes, sparring, competitions, demonstrations, belt testing, and related activities (collectively, "Karate Activities"),
and/or the use of the property, facilities (dojo), and services of KARATE GREENEGIN, and the transportation to or from any KARATE GREENEGIN activities indicates my acceptance of all the below-listed Release of
Liability & Assumption of Risk terms and conditions.\n\nI agree for myself, my student(s), and (if applicable) for the members of my family, to the following:\n\n1. Agreement To Follow Directions. I, my student(s),
and family agree to observe and obey all posted dojo rules and warnings, and further agree to follow any oral instructions or directions given by KARATE GREENEGIN, its instructors (Sensei, Sempai), employees,
representatives, volunteers, or agents.\n\n2. Assumption of the Risks and Release. I recognize that there are certain inherent risks associated with Karate Activities, including but not limited to physical contact,
strikes, kicks, throws, falls, strenuous exercise, illness, injury, and/or death. I assume full responsibility for personal injury to myself, my student(s), and my family members, and further release and discharge
KARATE GREENEGIN for injury, loss, or damage arising out of my, my student''s, or my family''s use of or presence upon the facilities (dojo) of KARATE GREENEGIN, and my, my student''s, or my family''s participation
in KARATE GREENEGIN Activities, whether caused by the fault of myself, my student(s), my family, KARATE GREENEGIN or other third parties. I release all claims that I, my student(s), and/or my family might have
based on actual or alleged negligent supervision, instruction, training, equipment (including protective gear) and/or facilities.\n\n3. Indemnification. I agree to indemnify and defend KARATE GREENEGIN against all
claims, causes of action, damages, judgments, costs, or expenses, including attorney fees and other litigation costs, which may in any way arise from my, my student''s, or my family''s use of or presence upon the
facilities (dojo) of KARATE GREENEGIN, and my, my student''s, or my family''s participation in KARATE GREENEGIN Activities.\n\n4. Fees. I agree to pay for all damages to the facilities (dojo) or equipment of KARATE
GREENEGIN caused by any negligent, reckless, or willful actions by me, my student, or my family.\n\n5. Consent. I consent to the participation of my student(s) in Karate Activities and agree on behalf of the
minor(s) to all of the terms and conditions of this agreement. By signing this Release of Liability, I represent that I have legal authority over and custody of my student(s).\n\n6. Medical Authorization. I
understand that it is my sole responsibility to inform KARATE GREENEGIN of any medical conditions, concerns, or information that may affect my, my student(s), and/or my family''s ability to participate safely in
Karate Activities. In the event of an injury to the above minor during Karate Activities, I give my permission to KARATE GREENEGIN or to the employees, representatives, or agents of KARATE GREENEGIN to arrange for
all necessary medical treatment for which I shall be financially responsible. This temporary authority will begin upon enrollment in any/all KARATE GREENEGIN Activities, upon the use of the property, facilities
(dojo), and services of KARATE GREENEGIN, and/or upon the transportation to or from any KARATE GREENEGIN activities, and will remain in effect until terminated in writing or when the Karate Activities are
completed. KARATE GREENEGIN shall have the following powers:\na. The power to seek appropriate medical treatment or attention on behalf of my student(s) as may be required by the circumstances, including treatment
by a physician, hospital, or other healthcare provider.\nb. The power to authorize medical treatment or medical procedures in an emergency situation; and\nc. The power to make appropriate decisions regarding
clothing, bodily nourishment and shelter.\n\n7. Applicable Law. Any legal or equitable claim that may arise from participation in the above shall be resolved under British Columbian law.\n\n8. No Duress. I agree
and acknowledge that I am under no pressure or duress to sign this agreement and that I have been given a reasonable opportunity to review it before signing. I further agree and acknowledge that I am free to have
my own legal counsel review this agreement if I so desire. I further agree and acknowledge that KARATE GREENEGIN has offered to refund any fees I have paid to use its facilities if I choose not to sign this
agreement.\n\n9. Arm''s Length Agreement. This agreement and each of its terms are the product of an arm''s length negotiation between the Parties. In the event any ambiguity is found to exist in the interpretation
of this agreement or any of its provisions, the Parties, and each of them, explicitly reject the application of any legal or equitable rule of interpretation which would lead to a construction either "for" or
"against" a particular party based upon their status as the drafter of a specific term, language, or provision giving rise to such ambiguity.\n\n10. Enforceability. The validity or enforceability of any provision
of this agreement, whether standing alone or as applied to a particular occurrence or circumstance, shall not affect the validity or enforceability of any other provision of this agreement or of any other
applications of such provision, as the case may be. Such invalid or unenforceable provision shall be deemed not to be a part of this agreement.\n\nI HAVE READ THIS DOCUMENT AND UNDERSTAND IT. I FURTHER UNDERSTAND
THAT BY AGREEING TO THIS RELEASE, I VOLUNTARILY SURRENDER CERTAIN LEGAL RIGHTS.',
        true)
ON CONFLICT (title) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO waivers (title, description, content, required)
VALUES ('Code of Conduct Agreement', 'Agreement to Adhere to School Rules and Etiquette',
        E'I understand that participation in all KARATE GREENEGIN''s karate training, classes, sparring, competitions, demonstrations, belt testing, and related activities (collectively, "Karate Activities"),
and/or the use of the property, facilities (dojo), and services of KARATE GREENEGIN, indicates my acceptance of all the below-listed Code Of Conduct Agreement terms and conditions.\n\nI agree for myself, my
student(s), and (if applicable) for the members of my family, to the following:\n\n1. Agreement To Follow Directions. I, my student(s), and family agree to observe and obey all posted dojo rules and warnings, and
further agree to follow any oral instructions or directions given by KARATE GREENEGIN, its instructors (Sensei, Sempai), employees, representatives, volunteers, or agents.\n\n2. Student Commitment. I, my
student(s), and family understand all KARATE GREENEGIN students are expected to;\n• Show respect (Rei) towards themselves, their peers (Kohai/Sempai), their instructors (Sensei), other authority figures, and the
dojo equipment and facilities;\n• Speak and behave appropriately at all times, adhering to dojo etiquette. Refrain from disruptive behavior, foul language, or actions that may compromise the dojo''s values or
safety;\n• Practice honesty and integrity (Makoto) at all times. Do not participate in: lying, cheating, misrepresentation of abilities or circumstances, or theft;\n• Demonstrate punctuality and regular attendance,
being prepared (mentally and physically) and ready to learn and train;\n• Comply with the dojo''s attire / dress code policy (proper gi, belt) at all times;\n• Comply with the dojo''s technology policy (e.g., phone
usage) at all times;\n• Commit to diligent practice (Keiko) both in the dojo and at home, striving for continuous improvement (Kaizen);\n• Commit to managing and maintaining personal health and hygiene, appropriate
for close-contact training;\n• Commit to upholding studies and maintaining strong academic marks (if applicable);\n• Devote themselves to the positive spirit of karate and community involvement;\n• Maintain a
positive attitude and serve as a role model (Sempai) for fellow students (Kohai).\n\n3. Parent/Guardian Commitment. I, my student(s), and family understand all KARATE GREENEGIN parents/guardians are expected to;\n•
Show respect towards themselves, their student(s), other students and their families, the instructors (Sensei, Sempai), other authority figures, and the dojo equipment and facilities;\n• Speak and behave
appropriately at all times when present at the dojo or related events. Refrain from interfering with instruction or undermining dojo discipline;\n• Model and encourage appropriate language, behavior, and respect
for karate principles for their student(s). Support the instructors in handling any disciplinary issues involving their student(s);\n• Practice honesty and integrity at all times in dealings with the dojo;\n•
Ensure their student(s) punctual and regular attendance, prepared and ready to train. Promptly communicate any absences or tardiness to the dojo administration;\n• Ensure their student(s) comply with the dojo''s
attire / dress code policy (clean, properly worn gi and belt) at all times;\n• Ensure they and their student(s) comply with the dojo''s technology policy at all times;\n• Encourage their student(s) commitment to
diligent practice both in the dojo and at home;\n• Ensure and facilitate their student(s) commitment to managing and maintaining personal health and hygiene;\n• Ensure and facilitate their student(s) commitment to
upholding studies and maintaining strong academic marks (if applicable);\n• Comply with the dojo''s adult expectations (e.g., spectator conduct) outlined in the dojo handbook or posted rules;\n• Support the
positive spirit of karate and community involvement;\n• Maintain a positive and supportive example for all students and families.\n• Ensure all payments, fees (tuition, testing fees, etc.), and other charges are
paid promptly, do not carry an unpaid balance, and follow all payment policy terms and conditions.\n\n4. Enforcement. I understand the code of conduct will be enforced for all KARATE GREENEGIN''s students,
parents/guardians, and families during all Karate Activities, as well as during the use of the property, facilities (dojo), and services of KARATE GREENEGIN, and/or when representing KARATE GREENEGIN. I understand
the code of conduct will be communicated to me, my student(s), and my family through; the dojo handbook; the parent portal; email communications; and verbally by instructors. I understand that if I, my student(s),
and/or my family fail to comply with the code of conduct, a maximum of two (2) warnings may be given, the first may be a verbal instructor warning, the second may be a written administration warning. Severe or
repeated violations may result in immediate disciplinary action.\n\n5. Disciplinary Action. I understand that if I, my student(s), and/or my family fail to comply with the code of conduct beyond the permitted
warnings, or in case of a severe violation, I, my student(s), and/or my family may be asked to leave the dojo and/or sit out of the activity, and may only be permitted to return once the conduct violation(s) have
been remedied and approved by the instructors/administration. I understand that if I, my student(s), and/or my family continuously fail to comply with the code of conduct, I, my student(s), and/or my family may be
suspended or removed from any/all KARATE GREENEGIN''s programs and activities, with no tuition proration or refunds granted.\n\n6. Applicable Law. Any legal or equitable claim that may arise from participation in
the above shall be resolved under British Columbian law.\n\n7. No Duress. I agree and acknowledge that I am under no pressure or duress to sign this agreement and that I have been given a reasonable opportunity to
review it before signing. I further agree and acknowledge that I am free to have my own legal counsel review this agreement if I so desire. I further agree and acknowledge that KARATE GREENEGIN has offered to
refund any fees I have paid to use its facilities if I choose not to sign this agreement.\n\n8. Arm''s Length Agreement. This agreement and each of its terms are the product of an arm''s length negotiation between
the Parties. In the event any ambiguity is found to exist in the interpretation of this agreement or any of its provisions, the Parties, and each of them, explicitly reject the application of any legal or equitable
rule of interpretation which would lead to a construction either "for" or "against" a particular party based upon their status as the drafter of a specific term, language, or provision giving rise to such
ambiguity.\n\n9. Enforceability. The validity or enforceability of any provision of this agreement, whether standing alone or as applied to a particular occurrence or circumstance, shall not affect the validity or
enforceability of any other provision of this agreement or of any other applications of such provision, as the case may be. Such invalid or unenforceable provision shall be deemed not to be a part of this
agreement.\n\nI HAVE READ THIS DOCUMENT AND UNDERSTAND IT. I FURTHER UNDERSTAND THAT BY AGREEING TO THIS AGREEMENT, I VOLUNTARILY SURRENDER CERTAIN LEGAL RIGHTS.',
        true)
ON CONFLICT (title) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO waivers (title, description, content, required)
VALUES ('Photo/Video Consent', 'Consent for Use of Images and Videos',
        E'I understand that participation in all KARATE GREENEGIN''s karate training, classes, sparring, competitions, demonstrations, belt testing, and related activities (collectively, "Karate Activities"),
and/or the use of the property, facilities (dojo), and services of KARATE GREENEGIN, indicates my acceptance of all the below-listed Photo / Video Release terms and conditions.\n\nI agree for myself, my student(s),
and (if applicable) for the members of my family, to the following:\n\n1. Release Of Likeness. I, hereby grant KARATE GREENEGIN, and/or the related companies permission to use my, my student''s, and/or my family''s
likeness in photographs and/or videos taken during Karate Activities in any/all of its publications, including but not limited to all of KARATE GREENEGIN''s printed materials (brochures, flyers), digital
publications (website, social media pages, email newsletters), and promotional materials. I understand and agree that any photograph or video using my, my student''s, and/or my family''s likeness will become
property of KARATE GREENEGIN and will not be returned.\n\n2. Authorization To Alter. I hereby irrevocably authorize KARATE GREENEGIN to edit, alter, copy, exhibit, publish or distribute photos and/or videos
containing my, my student''s, or my family''s likeness for purposes of publicizing KARATE GREENEGIN''s programs, classes, events, competitions, achievements, or for any other related, lawful purpose (e.g.,
instructional materials). In addition, I waive the right to inspect or approve the finished product, including printed or digital copies, or the specific use to which it may be applied, wherein my, my student''s,
and/or my family''s likeness appears.\n\n3. Fees. I acknowledge that since my, my student''s, and/or my family''s participation in KARATE GREENEGIN Activities and the use of the property, facilities (dojo), and
services of KARATE GREENEGIN is voluntary, I, my student(s), and/or my family will receive no financial compensation for the use of such photographs or videos. Additionally, I waive any right to royalties or other
compensation arising or related to the use of the photograph and/or video.\n\n4. Indemnification. I hereby hold harmless and release and forever discharge KARATE GREENEGIN from all claims, demands, and causes of
action which I, my student(s), my family, my heirs, representatives, executors, administrators, or any other persons acting on my behalf or on behalf of my estate have or may have by reason of this authorization
and release.\n\n5. Applicable Law. Any legal or equitable claim that may arise from participation in the above shall be resolved under British Columbian law.\n\n6. No Duress. I agree and acknowledge that I am under
no pressure or duress to sign this agreement and that I have been given a reasonable opportunity to review it before signing. I further agree and acknowledge that I am free to have my own legal counsel review this
agreement if I so desire. I further agree and acknowledge that KARATE GREENEGIN has offered to refund any fees I have paid to use its facilities if I choose not to sign this agreement.\n\n7. Arm''s Length
Agreement. This agreement and each of its terms are the product of an arm''s length negotiation between the Parties. In the event any ambiguity is found to exist in the interpretation of this agreement or any of
its provisions, the Parties, and each of them, explicitly reject the application of any legal or equitable rule of interpretation which would lead to a construction either "for" or "against" a particular party
based upon their status as the drafter of a specific term, language, or provision giving rise to such ambiguity.\n\n8. Enforceability. The validity or enforceability of any provision of this agreement, whether
standing alone or as applied to a particular occurrence or circumstance, shall not affect the validity or enforceability of any other provision of this agreement or of any other applications of such provision, as
the case may be. Such invalid or unenforceable provision shall be deemed not to be a part of this agreement.\n\nI HAVE READ THIS DOCUMENT AND UNDERSTAND IT. I FURTHER UNDERSTAND THAT BY AGREEING TO THIS RELEASE, I
VOLUNTARILY SURRENDER CERTAIN LEGAL RIGHTS.',
        true)
ON CONFLICT (title) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO waivers (title, description, content, required)
VALUES ('Payment Policy', 'Acknowledgement of Financial Obligations',
        E'I understand that participation in all KARATE GREENEGIN''s karate training, classes, sparring, competitions, demonstrations, belt testing, and related activities (collectively, "Karate Activities"),
and/or the use of the property, facilities (dojo), and services of KARATE GREENEGIN, indicates my acceptance of all the below-listed Payment Policy terms and conditions.\n\nI agree for myself, my student(s), and
(if applicable) for the members of my family, to the following:\n\n1. Commitment To Payment. I understand that participation in all KARATE GREENEGIN''s Karate Activities, and/or the use of the property, facilities
(dojo), and services of KARATE GREENEGIN, indicates my commitment to pay the full tuition, testing fees, and/or associated costs as outlined by KARATE GREENEGIN.\n\n2. When Payment Is Due. I understand that program
tuition amounts (e.g., monthly, term-based) are due as specified by KARATE GREENEGIN (e.g., on or before the 1st or 15th of the month/term prior to service). I understand specific fees for events like belt testing,
competitions, or special seminars must be paid by their respective deadlines. I understand any introductory offers, trial periods, or initial registration fees must be paid in full upon enrollment.\n\n3. Forms Of
Payment Accepted. I understand KARATE GREENEGIN accepts online payments through the parent portal via Amex, Discover, Mastercard, and Visa. Other payment methods may be accepted at the discretion of KARATE
GREENEGIN administration.\n\n4. Discount Terms And Conditions. I understand KARATE GREENEGIN may offer discounts such as Multi-Class, Multi-Student (Family), or specific program discounts. Current discount details,
eligibility, and terms (e.g., whether they can be combined) are available from KARATE GREENEGIN administration or on the website/portal. I understand these are the only discounts KARATE GREENEGIN currently offers
unless otherwise specified in writing.\n\n5. Scholarship Terms And Conditions. I understand KARATE GREENEGIN may offer scholarships or financial assistance based on need and availability. Application procedures,
requirements, and award details (e.g., percentage, applicable fees) are available from KARATE GREENEGIN administration. I understand that any misrepresentation of financial need or merit is grounds for scholarship
termination, and I would be solely responsible for returning any scholarship amounts awarded.\n\n6. Late Payments. I understand payments not received by the specified due date are considered late. I understand that
late payments may incur a late fee (e.g., $25.00) after a grace period (e.g., three (3) days). I understand any overdue fees not received by a specified date (e.g., the first (1st) of the following month) may
result in student(s) being temporarily suspended from participation in Karate Activities until full payment is received. I understand any/all late payment grace periods are intended solely for financial
flexibility, and I agree not to exploit this convenience.\n\n7. Absences. I understand if a student is absent for any/all personal reasons (sick, family trip, etc.) I will still be charged tuition for the period
covered. I understand KARATE GREENEGIN generally does not offer refunds or fee reimbursements for student absences. I understand select KARATE GREENEGIN classes may be eligible for a ‘makeup class’, subject to
availability and dojo policy. I understand statutory holidays may be excluded from tuition fees if the dojo is closed, as per the official schedule.\n\n8. Cancellations & Refunds. I understand my enrollment in any
KARATE GREENEGIN program requires I pay the tuition amount for the committed term (e.g., month, session). I understand the specific cancellation policy, including notice periods and any financial obligations for
early termination (e.g., paying for the current term), is outlined by KARATE GREENEGIN. I understand refunds are generally only issued under specific circumstances (e.g., long-term injury with doctor''s note) and
may be subject to administrative fees, as per dojo policy. I understand payments might be transferable to another KARATE GREENEGIN program or term only at the discretion of the administration. I agree to contact
the KARATE GREENEGIN administration team regarding any extraneous circumstances where I believe a refund or cancellation exception is warranted.\n\n9. Applicable Law. Any legal or equitable claim that may arise
from participation or financial obligations related to the above shall be resolved under British Columbian law.\n\n10. No Duress. I agree and acknowledge that I am under no pressure or duress to sign this agreement
and that I have been given a reasonable opportunity to review it before signing. I further agree and acknowledge that I am free to have my own legal counsel review this agreement if I so desire. I further agree and
acknowledge that KARATE GREENEGIN has offered to refund any fees I have paid to use its facilities if I choose not to sign this agreement.\n\n11. Arm''s Length Agreement. This agreement and each of its terms are
the product of an arm''s length negotiation between the Parties. In the event any ambiguity is found to exist in the interpretation of this agreement or any of its provisions, the Parties, and each of them,
explicitly reject the application of any legal or equitable rule of interpretation which would lead to a construction either "for" or "against" a particular party based upon their status as the drafter of a
specific term, language, or provision giving rise to such ambiguity.\n\n12. Enforceability. The validity or enforceability of any provision of this agreement, whether standing alone or as applied to a particular
occurrence or circumstance, shall not affect the validity or enforceability of any other provision of this agreement or of any other applications of such provision, as the case may be. Such invalid or unenforceable
provision shall be deemed not to be a part of this agreement.\n\nI HAVE READ THIS DOCUMENT AND UNDERSTAND IT. I FURTHER UNDERSTAND THAT BY AGREEING TO THIS POLICY, I VOLUNTARILY SURRENDER CERTAIN LEGAL RIGHTS.',
        true)
ON CONFLICT (title) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO waivers (title, description, content, required)
VALUES ('Dress Code Agreement', 'Acknowledgement of Attire Requirements',
        E'I understand that participation in all KARATE GREENEGIN''s Karate Activities, and/or the use of the property, facilities (dojo), and services of KARATE GREENEGIN, indicates my acceptance of all the
below-listed Attire / Dress Code Agreement terms and conditions.\n\nI agree for myself, my student(s), and (if applicable) for the members of my family, to the following:\n\n1. Agreement To Follow Directions. I, my
student(s), and/or family agree to follow KARATE GREENEGIN guidelines for dress code and attire during all Karate Activities, during use of the property, facilities (dojo), and services of KARATE GREENEGIN, and/or
when representing KARATE GREENEGIN (e.g., at competitions, demonstrations). I, my student(s), and/or family agree to observe and obey all posted rules and warnings regarding attire, and further agree to follow any
oral instructions or directions given by KARATE GREENEGIN instructors (Sensei, Sempai) or staff. I understand that specific attire guidelines can be found in the dojo handbook or obtained from KARATE GREENEGIN
administration (website: greeneginkarate.ca).\n\n2. Acceptable Attire (Karate Gi). I understand the primary acceptable attire for karate training is the official KARATE GREENEGIN uniform (Gi), consisting of jacket,
pants, and belt appropriate to the student''s rank. I understand the Gi must be kept clean, in good repair (no rips or tears), and worn correctly as instructed. I understand that for certain activities (e.g., trial
classes, specific workshops, fitness components), alternative appropriate athletic wear (e.g., t-shirt, athletic pants/shorts) may be permitted as specified by instructors. I understand hair must be kept neat and
tied back if long enough to obstruct vision or interfere with training. I understand personal grooming must be kept clean and tidy, and nails trimmed short for safety.\n\n3. Unacceptable Attire. I understand
unacceptable attire for regular karate training includes: street clothes (jeans, non-athletic wear); clothing with offensive graphics or language; excessively baggy or revealing clothing; jewelry (rings, necklaces,
bracelets, earrings - small stud earrings may be permissible at instructor discretion but must be taped if requested); shoes on the training mat (unless specific mat shoes are approved for medical reasons); dirty
or damaged Gis. I understand hair must not be styled in a way that interferes with training or safety (e.g., requires constant adjustment). I understand personal grooming must meet hygiene standards suitable for
close contact training (e.g., absence of strong perfumes/colognes, regular showering).\n\n4. Enforcement. I understand the dress code will be enforced for all KARATE GREENEGIN Activities. I understand instructors
have the authority to determine if attire is appropriate and safe. I understand dress code expectations will be communicated through the dojo handbook, website/portal, email communications, and verbally by
instructors. I understand that if I, my student(s), and/or my family fail to comply with the dress code, a warning may be given. Repeated non-compliance may result in being asked not to participate in that day''s
training.\n\n5. Disciplinary Action. I understand that if I, my student(s), and/or my family continuously fail to comply with the dress code, participation in Karate Activities may be restricted until the issue is
resolved. In persistent cases, this may be treated as a violation of the Code of Conduct and could lead to suspension or removal from programs without refund or proration.\n\n6. Applicable Law. Any legal or
equitable claim that may arise from participation related to attire shall be resolved under British Columbian law.\n\n7. No Duress. I agree and acknowledge that I am under no pressure or duress to sign this
agreement and that I have been given a reasonable opportunity to review it before signing. I further agree and acknowledge that I am free to have my own legal counsel review this agreement if I so desire. I further
agree and acknowledge that KARATE GREENEGIN has offered to refund any fees I have paid to use its facilities if I choose not to sign this agreement.\n\n8. Arm''s Length Agreement. This agreement and each of its
terms are the product of an arm''s length negotiation between the Parties. In the event any ambiguity is found to exist in the interpretation of this agreement or any of its provisions, the Parties, and each of
them, explicitly reject the application of any legal or equitable rule of interpretation which would lead to a construction either "for" or "against" a particular party based upon their status as the drafter of a
specific term, language, or provision giving rise to such ambiguity.\n\n9. Enforceability. The validity or enforceability of any provision of this agreement, whether standing alone or as applied to a particular
occurrence or circumstance, shall not affect the validity or enforceability of any other provision of this agreement or of any other applications of such provision, as the case may be. Such invalid or unenforceable
provision shall be deemed not to be a part of this agreement.\n\nI HAVE READ THIS DOCUMENT AND UNDERSTAND IT. I FURTHER UNDERSTAND THAT BY AGREEING TO THIS AGREEMENT, I VOLUNTARILY SURRENDER CERTAIN LEGAL RIGHTS.',
        true)
ON CONFLICT (title) DO UPDATE SET content = EXCLUDED.content;


-- Waiver Signatures table with enhanced structure
CREATE TABLE IF NOT EXISTS waiver_signatures
(
    id                uuid PRIMARY KEY                                           DEFAULT gen_random_uuid(),
    waiver_id         uuid REFERENCES waivers (id) ON DELETE CASCADE    NOT NULL,
    user_id           uuid REFERENCES auth.users (id) ON DELETE CASCADE NOT NULL,
    signed_at         timestamptz                                       NOT NULL DEFAULT now(),
    signature_data    text                                              NOT NULL,
    agreement_version text                                              NOT NULL, -- Add version tracking
    CONSTRAINT unique_waiver_signature UNIQUE (waiver_id, user_id)                -- Prevent duplicate signatures
);

DO
$$
BEGIN
IF NOT EXISTS (SELECT 1
                       FROM pg_indexes
                       WHERE indexname = 'idx_waiver_signatures_user_id') THEN
CREATE INDEX idx_waiver_signatures_user_id ON waiver_signatures (user_id);
END IF;

IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_waiver_signatures_waiver_id') THEN
CREATE INDEX idx_waiver_signatures_waiver_id ON waiver_signatures (waiver_id);
END IF;
END;
$$;

-- Policy Agreements table removed in favor of enhanced waiver_signatures

-- Waiver Signature Materialized View Refresh Functions
-- Fix for "must be owner of materialized view enrollment_waiver_status" error

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS refresh_enrollment_waiver_status_on_signature ON waiver_signatures;

-- Drop the existing function (it may have the wrong signature)
DROP FUNCTION IF EXISTS refresh_enrollment_waiver_status() CASCADE;

-- Create a simple procedure (not a trigger function) to refresh with elevated privileges
CREATE OR REPLACE FUNCTION refresh_enrollment_waiver_status_proc()
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    -- Refresh the materialized view with owner/superuser privileges
    REFRESH MATERIALIZED VIEW enrollment_waiver_status;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail
        RAISE WARNING 'Failed to refresh enrollment_waiver_status: %', SQLERRM;
END;
$$;

-- Create a trigger function that calls the procedure
CREATE OR REPLACE FUNCTION trigger_refresh_enrollment_waiver_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Call the security definer procedure
    PERFORM refresh_enrollment_waiver_status_proc();

    -- Return appropriate value for trigger
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Create the trigger using FOR EACH STATEMENT (more efficient)
CREATE TRIGGER refresh_enrollment_waiver_status_on_signature
    AFTER INSERT OR UPDATE OR DELETE ON waiver_signatures
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_enrollment_waiver_status();

-- Add comments explaining the functions
COMMENT ON FUNCTION refresh_enrollment_waiver_status_proc() IS 'Security definer procedure to refresh enrollment_waiver_status materialized view with elevated privileges.';
COMMENT ON FUNCTION trigger_refresh_enrollment_waiver_status() IS 'Trigger function that calls the security definer refresh procedure.';


-- Drop existing triggers first to avoid conflicts when recreating
DROP TRIGGER IF EXISTS families_updated ON families;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS
$$
BEGIN
INSERT INTO public.profiles (id, email)
VALUES (NEW.id, NEW.email);
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if it doesn't exist
DO
$$
    BEGIN
IF NOT EXISTS (SELECT 1
                       FROM pg_trigger
                       WHERE tgname = 'on_auth_user_created') THEN
CREATE TRIGGER on_auth_user_created
    AFTER INSERT
    ON auth.users
    FOR EACH ROW
EXECUTE PROCEDURE public.handle_new_user();
END IF;
END $$;

-- Enable row level security on all tables
ALTER TABLE families
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE students
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_students
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE belt_awards
    ENABLE ROW LEVEL SECURITY; -- Renamed table
DO $$
BEGIN
    IF to_regclass('public.attendance') IS NOT NULL THEN
        ALTER TABLE public.attendance
            ENABLE ROW LEVEL SECURITY;

        ALTER TABLE public.attendance
            ADD COLUMN IF NOT EXISTS marked_by uuid REFERENCES public.profiles(id);

        COMMENT ON COLUMN public.attendance.marked_by IS 'User (instructor/admin) who recorded the attendance entry';
    END IF;
END $$;

ALTER TABLE waivers
    ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiver_signatures
    ENABLE ROW LEVEL SECURITY;
-- policy_agreements table removed (kept from previous state)
ALTER TABLE profiles
    ENABLE ROW LEVEL SECURITY;

-- New Tax Tables --

-- Tax Rates Table
CREATE TABLE IF NOT EXISTS public.tax_rates
(
    id          uuid                     DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    name        text                                               NOT NULL UNIQUE,                         -- e.g., 'GST', 'PST_BC'
    rate        numeric(5, 4)                                      NOT NULL CHECK (rate >= 0 AND rate < 1), -- e.g., 0.05 for 5%
    description text                                               NULL,
    region      text                                               NULL,                                    -- e.g., 'BC', 'CA' (for federal) - Can be used for filtering applicability
    is_active   boolean                                            NOT NULL DEFAULT true,                   -- To enable/disable taxes
    created_at  timestamp with time zone DEFAULT now()             NOT NULL,
    updated_at  timestamp with time zone DEFAULT now()             NOT NULL
);

-- Enable RLS for tax_rates (Admins manage, Authenticated users can view active ones)
ALTER TABLE public.tax_rates
    ENABLE ROW LEVEL SECURITY;

DO
$$
BEGIN
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow authenticated users to view active tax rates'
                         AND tablename = 'tax_rates') THEN
CREATE POLICY "Allow authenticated users to view active tax rates" ON public.tax_rates
    FOR SELECT TO authenticated USING (is_active = true);
END IF;
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage tax rates' AND tablename = 'tax_rates') THEN
CREATE POLICY "Allow admins to manage tax rates" ON public.tax_rates
    FOR ALL USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    ) WITH CHECK (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;
END $$;

-- Insert initial tax rates (BC Example) - Make idempotent
DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM public.tax_rates LIMIT 1) THEN
INSERT INTO public.tax_rates (name, rate, description, region, is_active)
VALUES ('GST', 0.05, 'Goods and Services Tax', 'CA', true),
       ('PST_BC', 0.07, 'Provincial Sales Tax (British Columbia)', 'BC', true)
ON CONFLICT (name) DO UPDATE SET rate        = EXCLUDED.rate,
                                 description = EXCLUDED.description,
                                 region      = EXCLUDED.region,
                                 is_active   = EXCLUDED.is_active,
                                 updated_at  = now();
END IF;
END $$;


-- Payment Taxes Junction Table
CREATE TABLE IF NOT EXISTS public.payment_taxes
(
    id                       uuid                     DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    payment_id               uuid                                               NOT NULL REFERENCES public.payments (id) ON DELETE CASCADE,
    tax_rate_id              uuid                                               NOT NULL REFERENCES public.tax_rates (id) ON DELETE RESTRICT, -- Don't delete tax rate if used
    tax_amount               integer                                            NOT NULL CHECK (tax_amount >= 0),                             -- Tax amount in cents for this specific tax on this payment
    tax_rate_snapshot        numeric(5, 4)                                      NOT NULL,                                                     -- Store the rate applied at the time of payment
    tax_name_snapshot        text                                               NOT NULL,                                                     -- Store the name at the time of payment
    tax_description_snapshot text                                               NULL,                                                         -- Store the description at the time of payment
    created_at               timestamp with time zone DEFAULT now()             NOT NULL
);

-- Add tax_description_snapshot column idempotently
ALTER TABLE public.payment_taxes
    ADD COLUMN IF NOT EXISTS tax_description_snapshot text NULL;

-- Add indexes
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_taxes_payment_id') THEN
CREATE INDEX idx_payment_taxes_payment_id ON public.payment_taxes (payment_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_taxes_tax_rate_id') THEN
CREATE INDEX idx_payment_taxes_tax_rate_id ON public.payment_taxes (tax_rate_id);
END IF;
END;
$$;

-- Enable RLS for payment_taxes
ALTER TABLE public.payment_taxes
    ENABLE ROW LEVEL SECURITY;

DO
$$
    BEGIN
        -- Allow family members to view taxes linked to their payments
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow family members to view their payment taxes'
                         AND tablename = 'payment_taxes') THEN
CREATE POLICY "Allow family members to view their payment taxes" ON public.payment_taxes
    FOR SELECT USING (
    EXISTS (SELECT 1
            FROM public.payments pay
                     JOIN public.profiles p ON pay.family_id = p.family_id
            WHERE payment_taxes.payment_id = pay.id
              AND p.id = auth.uid())
    );
END IF;

-- Allow admins to manage all payment taxes
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage payment taxes' AND tablename = 'payment_taxes') THEN
CREATE POLICY "Allow admins to manage payment taxes" ON public.payment_taxes
    FOR ALL USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    ) WITH CHECK (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;
END $$;

-- End New Tax Tables --

-- Add RLS policies conditionally
DO
$$
BEGIN
-- Check if policy exists before creating/replacing
-- Modify policy to allow viewing own profile OR admin/instructor profiles
DROP POLICY IF EXISTS "Profiles are viewable by user or admin role" ON public.profiles; -- Drop potentially existing policy
DROP POLICY IF EXISTS "Profiles are viewable by user" ON public.profiles;
-- Drop older policy if exists

-- Check if the target policy already exists before creating it
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'profiles'
                         AND policyname = 'Profiles viewable by user, admin, or instructor') THEN
CREATE POLICY "Profiles viewable by user, admin, or instructor" ON public.profiles
    FOR SELECT USING (
    auth.uid() = id -- Can view own profile
        OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin'::profile_role, 'instructor'::profile_role)) -- Admins and instructors can view all profiles
    );
END IF;

IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'families'
                         AND policyname = 'Families are viewable by members') THEN
CREATE POLICY "Families are viewable by members" ON families
    FOR SELECT USING (
    EXISTS (SELECT 1
            FROM profiles
            WHERE profiles.family_id = families.id
              AND profiles.id = auth.uid())
    );
END IF;

-- Policy to allow authenticated users to insert new families
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'families'
                         AND policyname = 'Authenticated users can insert families') THEN
CREATE POLICY "Authenticated users can insert families" ON public.families
    FOR INSERT TO authenticated
    WITH CHECK (auth.role() = 'authenticated');
END IF;

-- Policy to allow admins to view all families
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'families'
                         AND policyname = 'Admins can view all families') THEN
CREATE POLICY "Admins can view all families" ON families
    FOR SELECT USING (
    EXISTS (SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'::profile_role)
    );
END IF;

-- Policy to allow admins to manage all families
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'families'
                         AND policyname = 'Admins can manage all families') THEN
CREATE POLICY "Admins can manage all families" ON families
    FOR ALL USING (
    EXISTS (SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'::profile_role)
    ) WITH CHECK (
    EXISTS (SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'::profile_role)
    );
END IF;

IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'guardians'
                         AND policyname = 'Guardians are viewable by family members') THEN
CREATE POLICY "Guardians are viewable by family members" ON guardians
    FOR SELECT USING (
    EXISTS (SELECT 1
            FROM profiles
            WHERE profiles.family_id = guardians.family_id
              AND profiles.id = auth.uid())
    );
END IF;

IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'students'
                         AND policyname = 'Students are viewable by family members') THEN
CREATE POLICY "Students are viewable by family members" ON students
    FOR SELECT USING (
    EXISTS (SELECT 1
            FROM profiles
            WHERE profiles.family_id = students.family_id
              AND profiles.id = auth.uid())
    );
END IF;

-- Policy to allow family members to INSERT students into their own family
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'students'
                         AND policyname = 'Family members can insert students into their family') THEN
CREATE POLICY "Family members can insert students into their family" ON students
    FOR INSERT
    WITH CHECK (
    EXISTS (SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.family_id = students.family_id)
    );
END IF;

-- Policy to allow family members to UPDATE students in their own family
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'students'
                         AND policyname = 'Family members can update students in their family') THEN
CREATE POLICY "Family members can update students in their family" ON students
    FOR UPDATE USING (
    EXISTS (SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.family_id = students.family_id)
    ) WITH CHECK (
    EXISTS (SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.family_id = students.family_id)
    );
END IF;

IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'payments'
                         AND policyname = 'Payments are viewable by family members') THEN
CREATE POLICY "Payments are viewable by family members" ON payments
    FOR SELECT USING (
    EXISTS (SELECT 1
            FROM profiles
            WHERE profiles.family_id = payments.family_id
              AND profiles.id = auth.uid())
    );
END IF;

IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'payment_students'
                         AND policyname = 'Payment_students are viewable by related users') THEN
CREATE POLICY "Payment_students are viewable by related users" ON payment_students
    FOR SELECT USING (
    EXISTS (SELECT 1
            FROM payments
                     JOIN profiles ON profiles.family_id = payments.family_id
            WHERE payment_students.payment_id = payments.id
              AND profiles.id = auth.uid())
    );
END IF;

IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'belt_awards'
                         AND policyname = 'Belt awards are viewable by family members' -- Renamed policy and table
        ) THEN
CREATE POLICY "Belt awards are viewable by family members" ON belt_awards -- Renamed policy and table
    FOR SELECT USING (
    EXISTS (SELECT 1
            FROM students
                     JOIN profiles ON profiles.family_id = students.family_id
            WHERE belt_awards.student_id = students.id -- Renamed table
              AND profiles.id = auth.uid())
    );
END IF;

-- Attendance RLS policies (session-based)
IF to_regclass('public.attendance') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1
                   FROM pg_policies
                   WHERE schemaname = 'public'
                     AND tablename = 'attendance'
                     AND policyname = 'Admins can manage all attendance') THEN
        CREATE POLICY "Admins can manage all attendance" ON public.attendance
            FOR ALL TO authenticated
            USING (EXISTS (SELECT 1
                           FROM public.profiles
                           WHERE profiles.id = auth.uid()
                             AND profiles.role = 'admin'::profile_role))
            WITH CHECK (EXISTS (SELECT 1
                                FROM public.profiles
                                WHERE profiles.id = auth.uid()
                                  AND profiles.role = 'admin'::profile_role));
    END IF;

    IF NOT EXISTS (SELECT 1
                   FROM pg_policies
                   WHERE schemaname = 'public'
                     AND tablename = 'attendance'
                     AND policyname = 'Family members can view their students attendance') THEN
        CREATE POLICY "Family members can view their students attendance" ON public.attendance
            FOR SELECT USING (
            EXISTS (SELECT 1
                    FROM public.students
                             JOIN public.profiles ON profiles.family_id = students.family_id
                    WHERE attendance.student_id = students.id
                      AND profiles.id = auth.uid())
            );
    END IF;

    IF NOT EXISTS (SELECT 1
                   FROM pg_policies
                   WHERE schemaname = 'public'
                     AND tablename = 'attendance'
                     AND policyname = 'Instructors can manage attendance for their sessions') THEN
        CREATE POLICY "Instructors can manage attendance for their sessions" ON public.attendance
            FOR ALL TO authenticated
            USING (EXISTS (SELECT 1
                           FROM public.profiles
                                    JOIN public.class_sessions cs ON cs.instructor_id = profiles.id
                           WHERE profiles.id = auth.uid()
                             AND profiles.role = 'instructor'::profile_role
                             AND cs.id = attendance.class_session_id))
            WITH CHECK (EXISTS (SELECT 1
                                FROM public.profiles
                                         JOIN public.class_sessions cs ON cs.instructor_id = profiles.id
                                WHERE profiles.id = auth.uid()
                                  AND profiles.role = 'instructor'::profile_role
                                  AND cs.id = attendance.class_session_id));
    END IF;
END IF;

IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'waivers'
                         AND policyname = 'Waivers are viewable by all authenticated users') THEN
CREATE POLICY "Waivers are viewable by all authenticated users" ON waivers
    FOR SELECT USING (auth.role() = 'authenticated');
END IF;

IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'waiver_signatures'
                         AND policyname = 'Waiver signatures are viewable by the signer') THEN
CREATE POLICY "Waiver signatures are viewable by the signer" ON waiver_signatures
    FOR SELECT USING (auth.uid() = user_id);
END IF;

-- Enhanced waiver_signatures RLS policies
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'waiver_signatures'
                         AND policyname = 'Users can view their waiver signatures') THEN
CREATE POLICY "Users can view their waiver signatures" ON waiver_signatures
    FOR SELECT USING (auth.uid() = user_id);
END IF;

IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'waiver_signatures'
                         AND policyname = 'Users can create their waiver signatures') THEN
CREATE POLICY "Users can create their waiver signatures" ON waiver_signatures
    FOR INSERT WITH CHECK (auth.uid() = user_id);
END IF;

IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'waiver_signatures'
                         AND policyname = 'Admins can manage waiver signatures') THEN
CREATE POLICY "Admins can manage waiver signatures" ON waiver_signatures
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1
                   FROM profiles
                   WHERE profiles.id = auth.uid()
                     AND profiles.role = 'admin'::profile_role));
END IF;
END $$;

-- Add validation constraints conditionally
DO
$$
BEGIN
-- Check if constraint exists before adding
IF NOT EXISTS (SELECT 1
                       FROM pg_constraint
                       WHERE conname = 'valid_province') THEN
ALTER TABLE families
    ADD CONSTRAINT valid_province
        CHECK (province IN ('AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'));
END IF;

-- T-shirt size constraint is now handled by the enum type
-- IF NOT EXISTS (SELECT 1
--                        FROM pg_constraint
--                        WHERE conname = 'valid_t_shirt_size') THEN
-- ALTER TABLE students
--     ADD CONSTRAINT valid_t_shirt_size
--         CHECK (t_shirt_size IN ('YXS', 'YS', 'YM', 'YL', 'YXL', 'AS', 'AM', 'AL', 'AXL', 'A2XL'));
-- END IF;
END $$;

-- Add update timestamp trigger for families table
-- Only create trigger if it doesn't exist
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1
                       FROM pg_trigger
                       WHERE tgname = 'families_updated') THEN
CREATE TRIGGER families_updated
    BEFORE UPDATE
    ON families
    FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
END IF;
END $$;

-- Function to count successful payments for a student (used for tier calculation)
-- Make it SECURITY DEFINER to ensure it can read payments table regardless of caller RLS
CREATE OR REPLACE FUNCTION public.count_successful_student_payments(p_student_id UUID)
    RETURNS INT
    LANGUAGE plpgsql
    SECURITY DEFINER -- Important for accessing payments table across users if needed by admin/server logic
AS
$$
DECLARE
    payment_count INT;
BEGIN
SELECT COUNT(*)
INTO payment_count
FROM public.payment_students ps
         JOIN public.payments p ON ps.payment_id = p.id
WHERE ps.student_id = p_student_id
  AND p.status = 'succeeded'; -- Ensure using the correct enum value ('succeeded')

RETURN payment_count;
END;
$$;

-- Verification queries (commented out - uncomment to run)
/*
-- Check table structure
\d+ families

-- Verify constraints
SELECT conname, conrelid::regclass, contype
FROM pg_constraint
WHERE conrelid::regclass::text IN ('families', 'students');

-- Check RLS policies
SELECT * FROM pg_policies;
*/


-- 1. Create the table to track purchased 1:1 sessions (idempotently)
CREATE TABLE IF NOT EXISTS public.one_on_one_sessions
( -- Add IF NOT EXISTS
    id                 uuid                     DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    payment_id         uuid                                               NOT NULL REFERENCES public.payments (id) ON DELETE CASCADE,
    family_id          uuid                                               NOT NULL REFERENCES public.families (id) ON DELETE CASCADE,
    purchase_date      timestamp with time zone DEFAULT now()             NOT NULL,
    quantity_purchased integer                                            NOT NULL CHECK (quantity_purchased > 0),
    quantity_remaining integer                                            NOT NULL CHECK (quantity_remaining >= 0),
    created_at         timestamp with time zone DEFAULT now()             NOT NULL,
    updated_at         timestamp with time zone DEFAULT now()             NOT NULL,
    CONSTRAINT check_remaining_not_greater_than_purchased CHECK (quantity_remaining <= quantity_purchased)
);

-- Add indexes for common queries (idempotently)
DO
$$
    BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_one_on_one_sessions_family_id') THEN
CREATE INDEX idx_one_on_one_sessions_family_id ON public.one_on_one_sessions (family_id);
END IF;
END $$;
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_one_on_one_sessions_payment_id') THEN
CREATE INDEX idx_one_on_one_sessions_payment_id ON public.one_on_one_sessions (payment_id);
END IF;
END $$;

-- Enable Row Level Security (Important!)
ALTER TABLE public.one_on_one_sessions
    ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
DO
$$
BEGIN
-- Allow families to view their own session balances
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow family members to view their own sessions'
                         AND tablename = 'one_on_one_sessions') THEN
CREATE POLICY "Allow family members to view their own sessions" ON public.one_on_one_sessions
    FOR SELECT USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.family_id = one_on_one_sessions.family_id)
    );
END IF;

-- Allow admins to manage all sessions (SELECT, INSERT, UPDATE, DELETE)
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage all sessions'
                         AND tablename = 'one_on_one_sessions') THEN
CREATE POLICY "Allow admins to manage all sessions" ON public.one_on_one_sessions
    FOR ALL USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    ) WITH CHECK (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;
END $$;

-- Grant access to service_role (for backend operations) - Note: service_role bypasses RLS by default.
-- Policies for service_role are typically not needed,
-- but ensure your backend uses the service role key for modifications.


-- 2. Create the table to track usage of 1:1 sessions (idempotently)
CREATE TABLE IF NOT EXISTS public.one_on_one_session_usage
(                                                                                                                                                  -- Add IF NOT EXISTS
    id                  uuid                     DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    session_purchase_id uuid                                               NOT NULL REFERENCES public.one_on_one_sessions (id) ON DELETE RESTRICT, -- Prevent deleting purchase if usage exists
    student_id          uuid                                               NOT NULL REFERENCES public.students (id) ON DELETE CASCADE,
    usage_date          timestamp with time zone DEFAULT now()             NOT NULL,
    recorded_by         uuid                                               NULL REFERENCES auth.users (id) ON DELETE SET NULL,                     -- Link to admin user who recorded it
    notes               text                                               NULL,
    created_at          timestamp with time zone DEFAULT now()             NOT NULL
);

-- Add indexes (idempotently)
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1
                       FROM pg_indexes
                       WHERE indexname = 'idx_one_on_one_session_usage_session_purchase_id') THEN
CREATE INDEX idx_one_on_one_session_usage_session_purchase_id ON public.one_on_one_session_usage (session_purchase_id);
END IF;
END $$;
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_one_on_one_session_usage_student_id') THEN
CREATE INDEX idx_one_on_one_session_usage_student_id ON public.one_on_one_session_usage (student_id);
END IF;
END $$;
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_one_on_one_session_usage_recorded_by') THEN
CREATE INDEX idx_one_on_one_session_usage_recorded_by ON public.one_on_one_session_usage (recorded_by);
END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.one_on_one_session_usage
    ENABLE ROW LEVEL SECURITY;

-- Grant access policies as needed
DO
$$
BEGIN
-- Allow families to see usage linked to their sessions
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow family members to view usage of their sessions'
                         AND tablename = 'one_on_one_session_usage') THEN
CREATE POLICY "Allow family members to view usage of their sessions" ON public.one_on_one_session_usage
    FOR SELECT USING (
    EXISTS (SELECT 1
            FROM public.one_on_one_sessions s
                     JOIN public.profiles p ON s.family_id = p.family_id
            WHERE one_on_one_session_usage.session_purchase_id = s.id
              AND p.id = auth.uid())
    );
END IF;

-- Allow admins to manage all session usage (SELECT, INSERT, UPDATE, DELETE)
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage session usage'
                         AND tablename = 'one_on_one_session_usage') THEN
CREATE POLICY "Allow admins to manage session usage" ON public.one_on_one_session_usage
    FOR ALL USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    ) WITH CHECK (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;
END $$;


-- Optional: Create a function or view to easily get the remaining balance per family
CREATE OR REPLACE FUNCTION public.get_family_one_on_one_balance(p_family_id uuid)
    RETURNS integer
    LANGUAGE sql
    STABLE -- Indicates the function doesn't modify the database
AS
$$
SELECT COALESCE(SUM(quantity_remaining), 0)
FROM public.one_on_one_sessions
WHERE family_id = p_family_id;
$$;

-- Example Usage: SELECT public.get_family_one_on_one_balance('your_family_id_here');

-- Or create a view (might be simpler for Remix loaders)
CREATE OR REPLACE VIEW public.family_one_on_one_balance AS
SELECT family_id,
       COALESCE(SUM(quantity_remaining), 0) AS total_remaining_sessions
FROM public.one_on_one_sessions
GROUP BY family_id;

-- Grant select access on the view
GRANT SELECT ON public.family_one_on_one_balance TO authenticated;
-- Or specific roles
-- RLS for views often relies on the underlying table policies or can be defined on the view itself if needed.

-- Remove the RENAME statement as the enum is now created with the correct value

-- Store related tables moved earlier in the script to resolve foreign key dependency.



-- --- Messaging Tables ---

-- Conversations Table
CREATE TABLE IF NOT EXISTS public.conversations
(
    id              uuid                     DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    created_at      timestamp with time zone DEFAULT now()             NOT NULL,
    updated_at      timestamp with time zone DEFAULT now()             NOT NULL,
    last_message_at timestamp with time zone DEFAULT now()             NOT NULL, -- For sorting conversations
    subject         text                                               NULL      -- Optional subject for the conversation
);

-- Enable RLS
ALTER TABLE public.conversations
    ENABLE ROW LEVEL SECURITY;

-- Add update timestamp trigger
DO
$$
    BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'conversations_updated') THEN
CREATE TRIGGER conversations_updated
    BEFORE UPDATE
    ON public.conversations
    FOR EACH ROW
EXECUTE FUNCTION public.update_modified_column();
END IF;
END $$;

-- Conversation Participants Table (Junction between conversations and users)
CREATE TABLE IF NOT EXISTS public.conversation_participants
(
    id              uuid                     DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    conversation_id uuid                                               NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
    user_id         uuid                                               NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE, -- Changed reference to public.profiles
    joined_at       timestamp with time zone DEFAULT now()             NOT NULL,
    -- Add a flag if needed later for unread status per user per conversation
    -- has_unread boolean DEFAULT false NOT NULL,
    last_read_at    timestamptz              DEFAULT now()             NOT NULL,                                                   -- Track when user last read this conversation
    CONSTRAINT unique_conversation_user UNIQUE (conversation_id, user_id)
);

-- Add last_read_at column idempotently if table already exists
ALTER TABLE public.conversation_participants
    ADD COLUMN IF NOT EXISTS last_read_at timestamptz DEFAULT now() NOT NULL;

-- Add indexes
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_conversation_participants_conversation_id') THEN
CREATE INDEX idx_conversation_participants_conversation_id ON public.conversation_participants (conversation_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_conversation_participants_user_id') THEN
CREATE INDEX idx_conversation_participants_user_id ON public.conversation_participants (user_id);
END IF;
END $$;

-- Enable RLS
ALTER TABLE public.conversation_participants
    ENABLE ROW LEVEL SECURITY;


-- Messages Table
CREATE TABLE IF NOT EXISTS public.messages
(
    id              uuid                     DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    conversation_id uuid                                               NOT NULL REFERENCES public.conversations (id) ON DELETE CASCADE,
    sender_id       uuid                                               NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE, -- Changed reference to public.profiles
    content         text                                               NOT NULL CHECK (content <> ''),                             -- Ensure message content is not empty
    created_at      timestamp with time zone DEFAULT now()             NOT NULL
    -- Add attachment_url or similar if implementing attachments later
);

-- Add indexes
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_messages_conversation_id') THEN
CREATE INDEX idx_messages_conversation_id ON public.messages (conversation_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_messages_sender_id') THEN
CREATE INDEX idx_messages_sender_id ON public.messages (sender_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_messages_created_at') THEN
CREATE INDEX idx_messages_created_at ON public.messages (created_at); -- For sorting messages
END IF;
END $$;

-- Enable RLS
ALTER TABLE public.messages
    ENABLE ROW LEVEL SECURITY;

-- Trigger to update conversation's last_message_at timestamp
CREATE OR REPLACE FUNCTION public.update_conversation_last_message_at()
    RETURNS TRIGGER AS
$$
BEGIN
UPDATE public.conversations
SET last_message_at = NEW.created_at,
    updated_at      = NEW.created_at -- Also update conversation updated_at
WHERE id = NEW.conversation_id;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- Use DEFINER if needed to bypass RLS, but check implications

DO
$$
    BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'messages_update_conversation_ts') THEN
CREATE TRIGGER messages_update_conversation_ts
    AFTER INSERT
    ON public.messages
    FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_last_message_at();
END IF;
END $$;


-- --- Messaging RLS Policies ---

DO
$$
BEGIN
-- Conversations: Users can see conversations they are participants in. Admins can see all.
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow participants to view conversations'
                         AND tablename = 'conversations') THEN
CREATE POLICY "Allow participants to view conversations" ON public.conversations
    FOR SELECT USING (
    EXISTS (SELECT 1
            FROM public.conversation_participants cp
            WHERE cp.conversation_id = conversations.id
              AND cp.user_id = auth.uid())
        OR
    EXISTS ( -- Admins can view all
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'::profile_role)
    );
END IF;

-- Conversations: Users can create conversations (policy might need refinement based on who can initiate)
-- For now, allow any authenticated user to create a conversation record.
-- Participant insertion logic will handle who is actually *in* the conversation.
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow authenticated users to create conversations'
                         AND tablename = 'conversations') THEN
CREATE POLICY "Allow authenticated users to create conversations" ON public.conversations
    FOR INSERT TO authenticated WITH CHECK (true); -- Simplistic for now
END IF;

-- Conversation Participants: Users can see their own participation record. Admins can see all.
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow users to view their own participation'
                         AND tablename = 'conversation_participants') THEN
CREATE POLICY "Allow users to view their own participation" ON public.conversation_participants
    FOR SELECT USING (
    user_id = auth.uid()
        OR
    EXISTS ( -- Admins can view all
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'::profile_role)
    );
END IF;

-- Conversation Participants: Users can insert themselves into a conversation (or be added by logic).
-- This needs careful consideration. Let's allow users to insert records where user_id = auth.uid().
-- Server-side logic (e.g., an RPC function or action) should handle adding *other* users.
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow users to insert themselves as participants'
                         AND tablename = 'conversation_participants') THEN
CREATE POLICY "Allow users to insert themselves as participants" ON public.conversation_participants
    FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
END IF;
-- Consider adding admin insert policy if needed:
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to insert participants'
                         AND tablename = 'conversation_participants') THEN
CREATE POLICY "Allow admins to insert participants" ON public.conversation_participants
    FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;


-- Messages: Users can see messages in conversations they are participants in. Admins can see all.
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow participants to view messages' AND tablename = 'messages') THEN
CREATE POLICY "Allow participants to view messages" ON public.messages
    FOR SELECT USING (
    EXISTS (SELECT 1
            FROM public.conversation_participants cp
            WHERE cp.conversation_id = messages.conversation_id
              AND cp.user_id = auth.uid())
        OR
    EXISTS ( -- Admins can view all
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role = 'admin'::profile_role)
    );
END IF;

-- Messages: Users can insert messages into conversations they are participants in.
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow participants to insert messages' AND tablename = 'messages') THEN
CREATE POLICY "Allow participants to insert messages" ON public.messages
    FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() -- Ensure sender is the authenticated user
        AND
    EXISTS ( -- Ensure sender is a participant in the conversation
        SELECT 1
        FROM public.conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id
          AND cp.user_id = auth.uid())
    );
END IF;

-- Optional: Allow admins to delete messages (or specific roles)
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to delete messages' AND tablename = 'messages') THEN
CREATE POLICY "Allow admins to delete messages" ON public.messages
    FOR DELETE USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;

-- Conversation Participants: Allow users to update their own last_read_at timestamp.
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow users to update their own last_read_at'
                         AND tablename = 'conversation_participants') THEN
CREATE POLICY "Allow users to update their own last_read_at" ON public.conversation_participants
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid()) -- Can only update your own record
    WITH CHECK (user_id = auth.uid() AND conversation_id = conversation_id); -- Ensure user_id isn't changed, allow updating last_read_at
END IF;

END $$;

-- --- End Messaging RLS Policies ---

-- --- RPC Function for Creating Conversation ---

CREATE OR REPLACE FUNCTION public.create_new_conversation(
    p_sender_id uuid,
    -- p_recipient_id uuid, -- Removed recipient ID parameter
    p_subject text,
    p_content text
)
    RETURNS uuid -- Returns the new conversation_id
    LANGUAGE plpgsql
    SECURITY DEFINER -- Executes with the privileges of the function owner (usually postgres)
AS
$$
DECLARE
    new_conversation_id uuid;
admin_instructor_id uuid;
BEGIN
    -- Set search_path at the beginning of the function execution for this transaction
SET LOCAL search_path = public, extensions;

-- 1. Create the conversation
INSERT INTO public.conversations (subject)
VALUES (p_subject)
RETURNING id
INTO new_conversation_id;

-- 2. Add the sender as a participant
INSERT INTO public.conversation_participants (conversation_id, user_id)
VALUES (new_conversation_id, p_sender_id);

-- 3. Add all admin and instructor users as participants
FOR admin_instructor_id IN
SELECT id
FROM public.profiles
WHERE role IN ('admin'::profile_role, 'instructor'::profile_role)
    LOOP
-- Use INSERT ... ON CONFLICT DO NOTHING to avoid errors if a user is both sender and admin/instructor
INSERT INTO public.conversation_participants (conversation_id, user_id)
VALUES (new_conversation_id, admin_instructor_id)
ON CONFLICT (conversation_id, user_id) DO NOTHING;
END LOOP;

-- 4. Add the initial message
INSERT INTO public.messages (conversation_id, sender_id, content)
VALUES (new_conversation_id, p_sender_id, p_content);

-- 4. Return the new conversation ID
RETURN new_conversation_id;

EXCEPTION
    WHEN OTHERS THEN
        -- Log the error details if possible (requires extensions or specific logging setup)
        RAISE WARNING 'Error in create_new_conversation: SQLSTATE: %, MESSAGE: %', SQLSTATE, SQLERRM;
        -- Re-raise the original error to ensure the transaction fails
RAISE;
END;
$$;

-- Grant execute permission to authenticated users (note the changed parameter signature)
-- This allows logged-in users to call this function.
-- The SECURITY DEFINER ensures the operations *inside* the function run with higher privileges,
-- bypassing potential RLS issues during the multi-step insert process.
GRANT EXECUTE ON FUNCTION public.create_new_conversation(uuid, text, text) TO authenticated;

-- Function to mark a conversation as read by a user
CREATE OR REPLACE FUNCTION public.mark_conversation_as_read(
    p_conversation_id uuid,
    p_user_id uuid
)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY INVOKER -- Run as the calling user, respecting their RLS
AS
$$
BEGIN
UPDATE public.conversation_participants
SET last_read_at = now()
WHERE conversation_id = p_conversation_id
  AND user_id = p_user_id;

-- Check if the update affected any rows
IF NOT FOUND THEN
        RAISE EXCEPTION 'User % is not a participant in conversation %',
            p_user_id, p_conversation_id;
END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.mark_conversation_as_read(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_sender_last_read_at()
    RETURNS TRIGGER AS
$$
BEGIN
UPDATE public.conversation_participants
SET last_read_at = NEW.created_at
WHERE conversation_id = NEW.conversation_id
  AND user_id = NEW.sender_id;
RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER messages_update_sender_read_ts
    AFTER INSERT
    ON public.messages
    FOR EACH ROW
EXECUTE FUNCTION public.update_sender_last_read_at();

-- Drop existing function first to allow return type change
DROP FUNCTION IF EXISTS public.create_admin_initiated_conversation(uuid, uuid, text, text);

-- Function for Admin/Instructor to initiate a conversation with a specific family
CREATE OR REPLACE FUNCTION public.create_admin_initiated_conversation(
    p_sender_id uuid, -- The admin/instructor initiating
    p_target_family_id uuid, -- The family being messaged
    p_subject text,
    p_message_body text
)
    RETURNS jsonb -- Returns both conversation_id and message_id
    LANGUAGE plpgsql
    SECURITY DEFINER -- Executes with elevated privileges to add participants across families
AS
$$
DECLARE
    new_conversation_id uuid;
    new_message_id uuid;
    family_member_id    uuid;
BEGIN
    -- Set search_path for safety within SECURITY DEFINER
    SET LOCAL search_path = public, extensions;

    -- 1. Create the conversation
    INSERT INTO public.conversations (subject)
    VALUES (p_subject)
    RETURNING id
    INTO new_conversation_id;

    -- 2. Add the sender (admin/instructor) as a participant
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (new_conversation_id, p_sender_id);

    -- 3. Find all users associated with the target family and add them as participants
    FOR family_member_id IN
        SELECT id
        FROM public.profiles
        WHERE family_id = p_target_family_id
        LOOP
            -- Use INSERT ... ON CONFLICT DO NOTHING to avoid errors if a user somehow exists twice or overlaps
            -- Explicitly set last_read_at to -infinity for new family participants
            INSERT INTO public.conversation_participants (conversation_id, user_id, last_read_at)
            VALUES (new_conversation_id, family_member_id, '-infinity'::timestamptz)
            ON CONFLICT (conversation_id, user_id) DO NOTHING;
        END LOOP;

    -- 4. Add the initial message from the sender
    INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES (new_conversation_id, p_sender_id, p_message_body)
    RETURNING id INTO new_message_id;

    -- 5. Return both conversation ID and message ID
    RETURN jsonb_build_object(
        'conversation_id', new_conversation_id,
        'message_id', new_message_id
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error in create_admin_initiated_conversation: SQLSTATE: %, MESSAGE: %', SQLSTATE, SQLERRM;
        RAISE;
END;
$$;

-- Grant execute permission to authenticated users (Remix action already checks for admin/instructor role)
GRANT EXECUTE ON FUNCTION public.create_admin_initiated_conversation(uuid, uuid, text, text) TO authenticated;

-- Create function to execute admin queries safely
-- This function allows admin users to execute SQL queries through the DB chat interface
-- It has the following safety features:
-- 1. Only SELECT statements are allowed (no data modification)
-- 2. Timeout limit to prevent long-running queries
-- 3. Limited to admin permissions

-- Create the function
CREATE OR REPLACE FUNCTION execute_admin_query(query_text TEXT)
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER -- Function runs with the permissions of the creator
AS
$$
DECLARE
    result JSONB;
trimmed_query TEXT;
BEGIN

    -- Check if the query starts with 'select' (case-insensitive) followed by whitespace or end of string
    -- using a case-insensitive regular expression match (~*)
IF TRIM(query_text) !~* '^\s*select(\s|$)' THEN
        RAISE EXCEPTION 'Only SELECT statements are allowed for security reasons. Query must start with SELECT.';
END IF;

-- Set a statement timeout to prevent long-running queries
EXECUTE 'SET LOCAL statement_timeout = 5000';
-- 5 seconds in milliseconds

-- Execute the query and convert the result to JSON
EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query_text || ') t' INTO result;

-- Return an empty array instead of null if no results
IF result IS NULL THEN
        result := '[]'::JSONB;
END IF;

RETURN result;
EXCEPTION
    WHEN others THEN
        -- Return the error as JSON
        RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Set security policies
    ALTER FUNCTION execute_admin_query(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION execute_admin_query(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION execute_admin_query(TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION execute_admin_query(TEXT) TO service_role;

COMMENT ON FUNCTION execute_admin_query(TEXT) IS
    'Executes a SQL query and returns the results as JSONB. For security reasons:
    1. Only SELECT statements are allowed
    2. Queries have a 5-second timeout
    3. Function runs with SECURITY DEFINER to ensure proper permissions';

CREATE OR REPLACE FUNCTION execute_explain_query(query_text TEXT)
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
AS
$$
DECLARE
    result JSONB;
safe_query TEXT;
BEGIN
    -- Remove any trailing semicolons to avoid multi-statement attacks
safe_query := regexp_replace(trim(query_text), ';+$', '');

    -- Set a statement timeout to prevent long-running queries
    -- Basic check: Ensure it starts with SELECT (case-insensitive)
    -- This adds a layer of safety within the function itself.
IF safe_query !~* '^\s*select(\s|$)' THEN
        RAISE EXCEPTION 'Validation Error: Only SELECT statements can be explained.';
END IF;

-- Set a statement timeout
EXECUTE 'SET LOCAL statement_timeout = 3000';
-- 3 seconds

-- Execute EXPLAIN. This will throw an error if syntax is invalid.
-- We don't need to capture the output for simple validation.
EXECUTE 'EXPLAIN ' || safe_query;

-- If EXPLAIN succeeded without error, return success
RETURN jsonb_build_object('success', true);

EXCEPTION
    WHEN others THEN
        -- If EXPLAIN failed (invalid syntax, etc.), return the error
        RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

-- Set security policies
    ALTER FUNCTION execute_explain_query(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION execute_explain_query(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION execute_explain_query(TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION execute_explain_query(TEXT) TO service_role;

COMMENT ON FUNCTION execute_explain_query(TEXT) IS
    'Executes an EXPLAIN SQL query and returns the results as JSONB.
    Used for validating SQL syntax without actually executing potentially harmful queries.
    Returns errors in a standardized format for client handling.';
-- --- End RPC Function ---


-- --- End Messaging Tables ---


-- --- RLS Policy Verification Queries ---
-- Run these SELECT statements in the Supabase SQL Editor
-- to verify that the expected RLS policies have been created.

-- \echo '--- Verifying Policies for: families ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'families';

-- \echo '--- Verifying Policies for: guardians ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'guardians';

-- \echo '--- Verifying Policies for: students ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'students';

-- \echo '--- Verifying Policies for: products ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'products';

-- \echo '--- Verifying Policies for: product_variants ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'product_variants';

-- \echo '--- Verifying Policies for: orders ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'orders';

-- \echo '--- Verifying Policies for: order_items ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'order_items';

-- \echo '--- Verifying Policies for: payments ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments';

-- \echo '--- Verifying Policies for: payment_students ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_students';

-- \echo '--- Verifying Policies for: belt_awards ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'belt_awards';

-- \echo '--- Verifying Policies for: attendance ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'attendance';

-- \echo '--- Verifying Policies for: waivers ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waivers';

-- \echo '--- Verifying Policies for: waiver_signatures ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'waiver_signatures';

-- \echo '--- Verifying Policies for: profiles ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles';

-- \echo '--- Verifying Policies for: tax_rates ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tax_rates';

-- \echo '--- Verifying Policies for: payment_taxes ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payment_taxes';

-- \echo '--- Verifying Policies for: one_on_one_sessions ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'one_on_one_sessions';

-- \echo '--- Verifying Policies for: one_on_one_session_usage ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'one_on_one_session_usage';

-- \echo '--- Verifying Policies for: conversations ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversations';

-- \echo '--- Verifying Policies for: conversation_participants ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'conversation_participants';

-- \echo '--- Verifying Policies for: messages ---'
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = 'messages';

-- --- End RLS Policy Verification Queries ---


-- --- RPC Functions ---

-- Function to atomically decrement product variant stock
-- SECURITY DEFINER allows it to run with the privileges of the function owner (usually postgres)
-- This bypasses RLS for the specific update operation, ensuring stock can be decremented by the webhook handler (via service_role client).
CREATE OR REPLACE FUNCTION public.decrement_variant_stock(variant_id uuid, decrement_quantity integer)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER -- Important: Allows bypassing RLS for this specific operation
AS
$$
BEGIN
UPDATE public.product_variants
SET stock_quantity = stock_quantity - decrement_quantity
WHERE id = variant_id
  AND stock_quantity >= decrement_quantity;
-- Ensure stock doesn't go negative

-- Optional: Raise an exception if stock would go negative or variant not found
IF NOT FOUND THEN
        -- Check if the variant exists at all
        IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE id = variant_id) THEN
            RAISE EXCEPTION 'Product variant with ID % not found.', variant_id;
ELSE
            -- Variant exists, but stock was insufficient
            RAISE EXCEPTION 'Insufficient stock for product variant ID %.', variant_id;
END IF;
END IF;

END;
$$;

-- Grant execute permission to the service_role (or authenticated role if needed, but service_role is typical for webhooks)
GRANT EXECUTE ON FUNCTION public.decrement_variant_stock(uuid, integer) TO service_role;


-- Function to get conversation summaries for admin/instructor view
-- Drop the function first if it exists, to allow changing the return type
DROP FUNCTION IF EXISTS get_admin_conversation_summaries();
CREATE OR REPLACE FUNCTION get_admin_conversation_summaries()
    RETURNS TABLE
            (
                id                        UUID,
                subject                   TEXT,
                last_message_at           TIMESTAMPTZ,
                participant_display_names TEXT,
                is_unread_by_admin        BOOLEAN
            )
    LANGUAGE sql
    SECURITY DEFINER
AS
$$
WITH RelevantConversations AS (SELECT c.id, c.subject, c.last_message_at
                               FROM conversations c),
     ConversationParticipants AS (SELECT DISTINCT rc.id as conversation_id,
                                                  cp.user_id
                                  FROM conversation_participants cp
                                           JOIN RelevantConversations rc ON cp.conversation_id = rc.id),
     ParticipantDetails AS (SELECT cp.conversation_id,
                                   p.id   AS user_id,
                                   p.first_name,
                                   p.last_name,
                                   p.role,
                                   p.email,
                                   f.name AS family_name
                            FROM ConversationParticipants cp
                                     JOIN profiles p ON cp.user_id = p.id
                                     LEFT JOIN families f ON p.family_id = f.id),
     AggregatedNames AS (SELECT conversation_id,
                                COALESCE(
                                        CASE
                                            WHEN pd.role NOT IN ('admin', 'instructor') AND pd.family_name IS NOT NULL
                                                THEN pd.family_name
                                            ELSE NULL END,
                                        CASE
                                            WHEN pd.first_name IS NOT NULL AND pd.last_name IS NOT NULL
                                                THEN pd.first_name || ' ' || pd.last_name
                                            ELSE NULL END,
                                        pd.first_name,
                                        pd.last_name,
                                        split_part(pd.email, '@', 1),
                                        'User ' || substr(pd.user_id::text, 1, 6)
                                )                                                                       AS display_name,
                                (pd.role NOT IN ('admin', 'instructor') AND pd.family_name IS NOT NULL) as is_family_name
                         FROM ParticipantDetails pd),
     FamilyParticipantNames AS (SELECT conversation_id, string_agg(DISTINCT display_name, ', ') AS names
                                FROM AggregatedNames
                                WHERE is_family_name = TRUE
                                GROUP BY conversation_id),
     OtherParticipantNames AS (SELECT conversation_id, string_agg(DISTINCT display_name, ', ') AS names
                               FROM AggregatedNames
                               WHERE is_family_name = FALSE
                               GROUP BY conversation_id),
     UnreadStatus AS (SELECT rc.id                                               as conversation_id,
                             -- Directly use the result of EXISTS, which is BOOLEAN
                             EXISTS (SELECT 1
                                     FROM public.conversation_participants cp
                                              JOIN public.profiles p ON cp.user_id = p.id
                                     WHERE cp.conversation_id = rc.id
                                       AND p.role IN ('admin'::profile_role, 'instructor'::profile_role)
                                       AND cp.last_read_at < rc.last_message_at) as status_flag -- This is now a boolean
                      FROM RelevantConversations rc)
SELECT rc.id,
       COALESCE(rc.subject, 'Conversation with ' || COALESCE(fpn.names, opn.names, 'participants')),
       rc.last_message_at,
       COALESCE(fpn.names, opn.names,
                'Conversation ' || substr(rc.id::text, 1, 6) || '...') AS participant_display_names,
       us.status_flag                                                  AS is_unread_by_admin -- Use the renamed output column name here
FROM RelevantConversations rc
         LEFT JOIN FamilyParticipantNames fpn ON rc.id = fpn.conversation_id
         LEFT JOIN OtherParticipantNames opn ON rc.id = opn.conversation_id
         LEFT JOIN UnreadStatus us ON rc.id = us.conversation_id -- Join the renamed CTE
ORDER BY rc.last_message_at DESC;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_admin_conversation_summaries() TO service_role;
GRANT EXECUTE ON FUNCTION get_admin_conversation_summaries() TO authenticated;

-- Function to get conversation summaries for a specific family user
-- Takes user_id as input and respects RLS (SECURITY INVOKER)
-- Drop the function first if it exists, to allow changing the return type
DROP FUNCTION IF EXISTS get_family_conversation_summaries(UUID);
CREATE OR REPLACE FUNCTION get_family_conversation_summaries(p_user_id UUID)
    RETURNS TABLE
            (
                id                        UUID,
                subject                   TEXT,
                last_message_at           TIMESTAMPTZ,
                participant_display_names TEXT,
                unread_count              BIGINT -- Changed from INT to BIGINT for count(*)
            )
    LANGUAGE sql
    SECURITY INVOKER -- Run as the calling user, respecting their RLS
AS
$$
WITH UserConversations AS (
    -- Find conversations the specific user is part of
    SELECT cp.conversation_id, cp.last_read_at
    FROM public.conversation_participants cp
    WHERE cp.user_id = p_user_id),
     ConversationParticipants AS (
         -- Get all participants for those conversations, excluding the calling user
         SELECT cp.conversation_id,
                cp.user_id
         FROM public.conversation_participants cp
                  JOIN UserConversations uc ON cp.conversation_id = uc.conversation_id
         WHERE cp.user_id <> p_user_id -- Exclude the calling user themselves
     ),
     ParticipantDetails AS (
         -- Get profile details for the *other* participants
         SELECT cp.conversation_id,
                p.id AS user_id,
                p.first_name,
                p.last_name,
                p.role,
                p.email -- Include email as fallback
         FROM ConversationParticipants cp
                  JOIN public.profiles p ON cp.user_id = p.id
         -- No need to join families here, family users see admin/instructor names
     ),
     AggregatedNames AS (
         -- Aggregate names for display
         SELECT conversation_id,
                -- Use COALESCE to pick the first non-null name representation
                COALESCE(
                    -- Full name if first and last name exist
                        CASE
                            WHEN pd.first_name IS NOT NULL AND pd.last_name IS NOT NULL
                                THEN pd.first_name || ' ' || pd.last_name
                            ELSE NULL
                            END,
                    -- First name if only first name exists
                        pd.first_name,
                    -- Last name if only last name exists
                        pd.last_name,
                    -- Role if admin/instructor and name missing
                        CASE
                            WHEN pd.role IN ('admin'::profile_role, 'instructor'::profile_role) THEN initcap(pd.role::text) -- Capitalize role
                            ELSE NULL
                            END,
                    -- Email prefix as fallback
                        split_part(pd.email, '@', 1),
                    -- User ID prefix as last resort
                        'User ' || substr(pd.user_id::text, 1, 6)
                ) AS display_name
         FROM ParticipantDetails pd),
     FinalParticipantNames AS (
         -- Aggregate unique display names per conversation
         SELECT conversation_id,
                string_agg(DISTINCT display_name, ', ') AS names
         FROM AggregatedNames
         GROUP BY conversation_id),
     UnreadCounts AS (
         -- Calculate unread messages for each conversation for the calling user
         SELECT uc.conversation_id,
                COUNT(m.id) AS count
         FROM UserConversations uc
                  LEFT JOIN public.messages m ON uc.conversation_id = m.conversation_id
             -- Count messages created after the user's last read time for this conversation
             -- Treat NULL last_read_at as infinitely old, so all messages are considered newer
             AND m.created_at > COALESCE(uc.last_read_at, '-infinity'::timestamptz)
             -- Exclude messages sent by the user themselves from the unread count
             AND m.sender_id <> p_user_id
         GROUP BY uc.conversation_id)
-- Final selection joining conversations with aggregated names and unread counts
SELECT c.id,
       COALESCE(c.subject, 'Conversation with ' || COALESCE(fpn.names, 'Staff')),
       c.last_message_at,
       COALESCE(fpn.names, 'Staff', 'Conversation ' || substr(c.id::text, 1, 6) || '...') AS participant_display_names,
       COALESCE(unc.count, 0)                                                             AS unread_count -- Use COALESCE to ensure 0 if no unread messages
FROM public.conversations c
         JOIN UserConversations uc ON c.id = uc.conversation_id
         LEFT JOIN FinalParticipantNames fpn ON c.id = fpn.conversation_id
         LEFT JOIN UnreadCounts unc ON c.id = unc.conversation_id
ORDER BY c.last_message_at DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_family_conversation_summaries(UUID) TO authenticated;

-- Function to complete new user registration: creates family, updates profile, creates guardian
CREATE OR REPLACE FUNCTION public.complete_new_user_registration(
    p_user_id uuid,
    p_family_name text,
    p_address text,
    p_city text,
    p_province text,
    p_postal_code character varying(10),
    p_primary_phone character varying(20),
    p_user_email text, -- email of the user, for family record
    p_referral_source text DEFAULT NULL,
    p_referral_name text DEFAULT NULL,
    p_emergency_contact text DEFAULT NULL,
    p_health_info text DEFAULT NULL,
    p_contact1_first_name text DEFAULT NULL,
    p_contact1_last_name text DEFAULT NULL,
    p_contact1_type text DEFAULT NULL,
    p_contact1_home_phone character varying(20) DEFAULT NULL,
    p_contact1_work_phone character varying(20) DEFAULT NULL,
    p_contact1_cell_phone character varying(20) DEFAULT NULL
    -- p_contact1_email is user_email
)
    RETURNS uuid -- Returns the new family_id
    LANGUAGE plpgsql
    SECURITY DEFINER
AS
$$
DECLARE
    new_family_id uuid;
BEGIN
-- Ensure operations run with expected schema context
SET LOCAL search_path = public, extensions;

-- 1. Create the family record
INSERT INTO public.families (name, address, city, province, postal_code, primary_phone, email,
                             referral_source, referral_name, emergency_contact, health_info)
VALUES (p_family_name, p_address, p_city, p_province, p_postal_code, p_primary_phone, p_user_email,
        p_referral_source, p_referral_name, p_emergency_contact, p_health_info)
RETURNING id
INTO new_family_id;

-- 2. Update the user's profile with the new family_id and their first/last name
-- The profile record is created by the on_auth_user_created trigger.
UPDATE public.profiles
SET family_id  = new_family_id,
    first_name = p_contact1_first_name,
    last_name  = p_contact1_last_name
-- role is already defaulted to 'user' in the table definition and by the trigger's insert.
WHERE id = p_user_id;

-- 3. Create the primary guardian record
INSERT INTO public.guardians (family_id, first_name, last_name, relationship, home_phone, work_phone, cell_phone, email)
VALUES (new_family_id, p_contact1_first_name, p_contact1_last_name, p_contact1_type,
        p_contact1_home_phone, p_contact1_work_phone, p_contact1_cell_phone, p_user_email);

RETURN new_family_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.complete_new_user_registration(
    uuid, text, text, text, text, character varying(10), character varying(20), text,
    text, text, text, text, text, text, text, character varying(20), character varying(20), character varying(20)
) TO authenticated;


-- --- End RPC Functions ---

-- --- Discount Codes System ---

-- Discount Codes Table
CREATE TABLE IF NOT EXISTS public.discount_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    
    -- Discount Type
    discount_type text NOT NULL CHECK (discount_type IN ('fixed_amount', 'percentage')),
    discount_value numeric(10,4) NOT NULL CHECK (discount_value > 0), -- DEPRECATED: Use discount_value_cents instead
    discount_value_cents integer NOT NULL DEFAULT 0 CHECK (discount_value_cents >= 0), -- Discount amount in cents
    
    -- Usage Restrictions
    usage_type text NOT NULL CHECK (usage_type IN ('one_time', 'ongoing')),
    max_uses integer NULL, -- NULL = unlimited
    current_uses integer NOT NULL DEFAULT 0,
    
    -- Applicability
    applicable_to payment_type_enum[] NOT NULL,
    scope text NOT NULL CHECK (scope IN ('per_student', 'per_family')),
    
    -- Validity
    is_active boolean NOT NULL DEFAULT true,
    valid_from timestamptz NOT NULL DEFAULT now(),
    valid_until timestamptz NULL,
    
    -- Creation tracking
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_automatically boolean NOT NULL DEFAULT false,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add missing columns to discount_codes table if they don't exist
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS family_id uuid NULL REFERENCES public.families(id) ON DELETE CASCADE;
ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS student_id uuid NULL REFERENCES public.students(id) ON DELETE CASCADE;

-- Add constraints if they don't exist
DO
$$
    BEGIN
        -- Add association check constraint if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discount_codes_association_check') THEN
ALTER TABLE public.discount_codes
    ADD CONSTRAINT discount_codes_association_check CHECK (
        (family_id IS NOT NULL AND student_id IS NULL) OR
        (family_id IS NULL AND student_id IS NOT NULL)
        );
END IF;

-- Add scope association check constraint if it doesn't exist
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discount_codes_scope_association_check') THEN
ALTER TABLE public.discount_codes
    ADD CONSTRAINT discount_codes_scope_association_check CHECK (
        (scope = 'per_family' AND family_id IS NOT NULL) OR
        (scope = 'per_student' AND student_id IS NOT NULL)
        );
END IF;
END $$;

-- Add indexes for discount_codes
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_codes_code') THEN
CREATE INDEX idx_discount_codes_code ON public.discount_codes (code);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_codes_active') THEN
CREATE INDEX idx_discount_codes_active ON public.discount_codes (is_active, valid_from, valid_until);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_codes_created_by') THEN
CREATE INDEX idx_discount_codes_created_by ON public.discount_codes (created_by);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_codes_family_id') THEN
CREATE INDEX idx_discount_codes_family_id ON public.discount_codes (family_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_codes_student_id') THEN
CREATE INDEX idx_discount_codes_student_id ON public.discount_codes (student_id);
END IF;
END $$;

-- Enable RLS for discount_codes
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for discount_codes
DO
$$
BEGIN
-- Allow authenticated users to view active discount codes
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow authenticated users to view active discount codes'
                         AND tablename = 'discount_codes') THEN
CREATE POLICY "Allow authenticated users to view active discount codes" ON public.discount_codes
    FOR SELECT TO authenticated USING (is_active = true AND valid_from <= now() AND
                                       (valid_until IS NULL OR valid_until >= now()));
END IF;

-- Allow admins to manage all discount codes
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage discount codes'
                         AND tablename = 'discount_codes') THEN
CREATE POLICY "Allow admins to manage discount codes" ON public.discount_codes
    FOR ALL USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    ) WITH CHECK (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;
END $$;

-- Discount Code Usage Table
CREATE TABLE IF NOT EXISTS public.discount_code_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    discount_code_id uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
    payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    student_id uuid NULL REFERENCES public.students(id) ON DELETE CASCADE, -- NULL for family-wide discounts
    
    -- Applied discount details (snapshot)
    discount_amount integer NOT NULL CHECK (discount_amount >= 0), -- in cents
    original_amount integer NOT NULL CHECK (original_amount >= 0), -- in cents
    final_amount integer NOT NULL CHECK (final_amount >= 0), -- in cents
    
    used_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for discount_code_usage
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_code_usage_discount_code_id') THEN
CREATE INDEX idx_discount_code_usage_discount_code_id ON public.discount_code_usage (discount_code_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_code_usage_payment_id') THEN
CREATE INDEX idx_discount_code_usage_payment_id ON public.discount_code_usage (payment_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_code_usage_family_id') THEN
CREATE INDEX idx_discount_code_usage_family_id ON public.discount_code_usage (family_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_code_usage_student_id') THEN
CREATE INDEX idx_discount_code_usage_student_id ON public.discount_code_usage (student_id);
END IF;
END $$;

-- Enable RLS for discount_code_usage
ALTER TABLE public.discount_code_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for discount_code_usage
DO
$$
BEGIN
-- Allow users to view their own family's discount usage
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow users to view own family discount usage'
                         AND tablename = 'discount_code_usage') THEN
CREATE POLICY "Allow users to view own family discount usage" ON public.discount_code_usage
    FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.family_id = family_id)
    );
END IF;

-- Allow admins to view all discount usage
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to view all discount usage'
                         AND tablename = 'discount_code_usage') THEN
CREATE POLICY "Allow admins to view all discount usage" ON public.discount_code_usage
    FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;

-- Allow system to insert discount usage records
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow system to insert discount usage'
                         AND tablename = 'discount_code_usage') THEN
CREATE POLICY "Allow system to insert discount usage" ON public.discount_code_usage
    FOR INSERT TO authenticated WITH CHECK (true); -- Will be controlled by application logic
END IF;
END $$;

-- Add discount fields to payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS discount_code_id uuid NULL REFERENCES public.discount_codes(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS discount_amount integer NULL CHECK (discount_amount >= 0); -- in cents

-- Add index for payments discount_code_id
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payments_discount_code_id') THEN
CREATE INDEX idx_payments_discount_code_id ON public.payments (discount_code_id);
END IF;
END $$;

-- Discount Templates Table
CREATE TABLE IF NOT EXISTS public.discount_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    
    -- Discount Type
    discount_type text NOT NULL CHECK (discount_type IN ('fixed_amount', 'percentage')),
    discount_value numeric(10,4) NOT NULL CHECK (discount_value > 0), -- DEPRECATED: Use discount_value_cents instead
    discount_value_cents integer NOT NULL DEFAULT 0 CHECK (discount_value_cents >= 0), -- Discount amount in cents
    
    -- Usage Restrictions
    usage_type text NOT NULL CHECK (usage_type IN ('one_time', 'ongoing')),
    max_uses integer NULL, -- NULL = unlimited
    
    -- Applicability
    applicable_to payment_type_enum[] NOT NULL,
    scope text NOT NULL CHECK (scope IN ('per_student', 'per_family')),
    
    -- Template status
    is_active boolean NOT NULL DEFAULT true,
    
    -- Creation tracking
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for discount_templates
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_templates_active') THEN
CREATE INDEX idx_discount_templates_active ON public.discount_templates (is_active);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_templates_created_by') THEN
CREATE INDEX idx_discount_templates_created_by ON public.discount_templates (created_by);
END IF;
END $$;

-- Enable RLS for discount_templates
ALTER TABLE public.discount_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for discount_templates
DO
$$
BEGIN
-- Allow admins to manage all discount templates
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage discount templates'
                         AND tablename = 'discount_templates') THEN
CREATE POLICY "Allow admins to manage discount templates" ON public.discount_templates
    FOR ALL USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    ) WITH CHECK (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;
END $$;

-- Add trigger to update discount_templates.updated_at
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1
                       FROM information_schema.triggers
                       WHERE trigger_name = 'discount_templates_updated') THEN
CREATE TRIGGER discount_templates_updated
    BEFORE UPDATE
    ON public.discount_templates
    FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
END IF;
END $$;

-- Add trigger to update discount_codes.updated_at
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1
                       FROM pg_trigger
                       WHERE tgname = 'discount_codes_updated') THEN
CREATE TRIGGER discount_codes_updated
    BEFORE UPDATE
    ON public.discount_codes
    FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
END IF;
END $$;

-- Function to validate and apply discount code
-- Fixed column ambiguity issue by using different variable names
CREATE OR REPLACE FUNCTION public.validate_discount_code(
    p_code text,
    p_family_id uuid,
    p_student_id uuid DEFAULT NULL,
    p_subtotal_amount integer DEFAULT NULL, -- in cents
    p_applicable_to payment_type_enum DEFAULT 'monthly_group'
)
RETURNS TABLE(
    is_valid boolean,
    discount_code_id uuid,
    discount_amount integer, -- in cents
    error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_discount_code public.discount_codes%ROWTYPE;
v_calculated_discount integer;
v_usage_count integer;
v_result_discount_code_id uuid; -- Use different variable name to avoid ambiguity
BEGIN
    -- Initialize return values
is_valid := false;
v_result_discount_code_id := NULL;
discount_amount := 0;
error_message := NULL;
    
    -- Find the discount code
SELECT *
INTO v_discount_code
FROM public.discount_codes
WHERE code = p_code
  AND is_active = true;

-- Check if code exists
IF NOT FOUND THEN
        error_message := 'Invalid discount code';
RETURN QUERY
SELECT is_valid, v_result_discount_code_id, discount_amount, error_message;
RETURN;
END IF;

-- Check validity dates
IF v_discount_code.valid_from > now() THEN
        error_message := 'Discount code is not yet valid';
RETURN QUERY
SELECT is_valid, v_result_discount_code_id, discount_amount, error_message;
RETURN;
END IF;

IF v_discount_code.valid_until IS NOT NULL AND v_discount_code.valid_until < now() THEN
        error_message := 'Discount code has expired';
RETURN QUERY
SELECT is_valid, v_result_discount_code_id, discount_amount, error_message;
RETURN;
END IF;

-- Check applicability
IF NOT (p_applicable_to = ANY(v_discount_code.applicable_to)) THEN
        error_message := 'Discount code is not applicable to this type of purchase';
RETURN QUERY
SELECT is_valid, v_result_discount_code_id, discount_amount, error_message;
RETURN;
END IF;

-- Check usage limits
IF v_discount_code.max_uses IS NOT NULL THEN
SELECT current_uses
INTO v_usage_count
FROM public.discount_codes
WHERE id = v_discount_code.id;

IF v_usage_count >= v_discount_code.max_uses THEN
            error_message := 'Discount code has reached its usage limit';
RETURN QUERY
SELECT is_valid, v_result_discount_code_id, discount_amount, error_message;
RETURN;
END IF;
END IF;

-- Check for previous usage if one-time code
IF v_discount_code.usage_type = 'one_time' THEN
        IF v_discount_code.scope = 'per_family' THEN
            -- Check if family has used this code before
            IF EXISTS (
                SELECT 1 FROM public.discount_code_usage
                WHERE discount_code_usage.discount_code_id = v_discount_code.id AND family_id = p_family_id
            ) THEN
                error_message := 'This discount code has already been used by your family';
RETURN QUERY
SELECT is_valid, v_result_discount_code_id, discount_amount, error_message;
RETURN;
END IF;
ELSIF v_discount_code.scope = 'per_student' AND p_student_id IS NOT NULL THEN
            -- Check if student has used this code before
            IF EXISTS (
                SELECT 1 FROM public.discount_code_usage
                WHERE discount_code_usage.discount_code_id = v_discount_code.id AND student_id = p_student_id
            ) THEN
                error_message := 'This discount code has already been used for this student';
RETURN QUERY
SELECT is_valid, v_result_discount_code_id, discount_amount, error_message;
RETURN;
END IF;
END IF;
END IF;

-- Calculate discount amount
IF p_subtotal_amount IS NOT NULL THEN
        IF v_discount_code.discount_type = 'fixed_amount' THEN
            -- Use discount_value_cents directly (already in cents)
            v_calculated_discount := v_discount_code.discount_value_cents;
            -- Ensure discount doesn't exceed subtotal
            v_calculated_discount := LEAST(v_calculated_discount, p_subtotal_amount);
        ELSIF v_discount_code.discount_type = 'percentage' THEN
            -- Calculate percentage of subtotal using discount_value_cents (percentage * 100, e.g., 15% = 1500)
            v_calculated_discount := (p_subtotal_amount * v_discount_code.discount_value_cents / 10000)::integer;
END IF;
END IF;

-- Return success
is_valid := true;
v_result_discount_code_id := v_discount_code.id;
discount_amount := COALESCE(v_calculated_discount, 0);

RETURN QUERY
SELECT is_valid, v_result_discount_code_id, discount_amount, error_message;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.validate_discount_code(text, uuid, uuid, integer, payment_type_enum) TO authenticated;

-- Function to increment discount code usage
CREATE OR REPLACE FUNCTION public.increment_discount_code_usage(
    p_discount_code_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
UPDATE public.discount_codes
SET current_uses = current_uses + 1,
    updated_at   = now()
WHERE id = p_discount_code_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.increment_discount_code_usage(uuid) TO authenticated;

-- --- Automatic Discount Assignment System ---

-- Create discount_event_type enum
DO
$$
    BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_event_type') THEN
CREATE TYPE discount_event_type AS ENUM (
    'student_enrollment',
    'first_payment',
    'belt_promotion',
    'attendance_milestone',
    'family_referral',
    'birthday',
    'seasonal_promotion'
    );
END IF;
END $$;

-- Discount Events Table
CREATE TABLE IF NOT EXISTS public.discount_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type discount_event_type NOT NULL,
    student_id uuid NULL REFERENCES public.students(id) ON DELETE CASCADE,
    family_id uuid NULL REFERENCES public.families(id) ON DELETE CASCADE,
    event_data jsonb NULL, -- Additional event-specific data
    created_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz NULL
);

-- Add indexes for discount_events
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_events_type') THEN
CREATE INDEX idx_discount_events_type ON public.discount_events (event_type);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_events_student') THEN
CREATE INDEX idx_discount_events_student ON public.discount_events (student_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_events_family') THEN
CREATE INDEX idx_discount_events_family ON public.discount_events (family_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_events_processed') THEN
CREATE INDEX idx_discount_events_processed ON public.discount_events (processed_at);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_events_created_at') THEN
CREATE INDEX idx_discount_events_created_at ON public.discount_events (created_at);
END IF;
END $$;

-- Enable RLS for discount_events
ALTER TABLE public.discount_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for discount_events
DO
$$
BEGIN
-- Allow admins to manage all discount events
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage discount events'
                         AND tablename = 'discount_events') THEN
CREATE POLICY "Allow admins to manage discount events" ON public.discount_events
    FOR ALL USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    ) WITH CHECK (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;

-- Allow system to insert events
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow system to insert discount events'
                         AND tablename = 'discount_events') THEN
CREATE POLICY "Allow system to insert discount events" ON public.discount_events
    FOR INSERT TO authenticated WITH CHECK (true); -- Controlled by application logic
END IF;
END $$;

-- Discount Automation Rules Table
CREATE TABLE IF NOT EXISTS public.discount_automation_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text NULL,
    event_type discount_event_type NOT NULL,
    discount_template_id uuid REFERENCES public.discount_templates(id) ON DELETE CASCADE, -- Made nullable for multiple templates
    conditions jsonb NULL, -- Additional conditions (e.g., student age, belt level)
    applicable_programs uuid[] NULL, -- Array of program IDs this rule applies to (NULL = all programs)
    is_active boolean NOT NULL DEFAULT true,
    max_uses_per_student integer NULL, -- Limit how many times a student can benefit
    valid_from timestamptz NULL,
    valid_until timestamptz NULL,
    uses_multiple_templates boolean NOT NULL DEFAULT false, -- Flag for multiple template support
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Junction table for multiple discount templates per automation rule
CREATE TABLE IF NOT EXISTS public.automation_rule_discount_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_rule_id uuid NOT NULL REFERENCES public.discount_automation_rules(id) ON DELETE CASCADE,
    discount_template_id uuid NOT NULL REFERENCES public.discount_templates(id) ON DELETE CASCADE,
    sequence_order integer NOT NULL DEFAULT 1, -- Order of application
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(automation_rule_id, discount_template_id),
    UNIQUE(automation_rule_id, sequence_order)
);

-- Add indexes for discount_automation_rules
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_automation_rules_event_type') THEN
CREATE INDEX idx_automation_rules_event_type ON public.discount_automation_rules (event_type);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_automation_rules_active') THEN
CREATE INDEX idx_automation_rules_active ON public.discount_automation_rules (is_active);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_automation_rules_template') THEN
CREATE INDEX idx_automation_rules_template ON public.discount_automation_rules (discount_template_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_automation_rules_validity') THEN
CREATE INDEX idx_automation_rules_validity ON public.discount_automation_rules (valid_from, valid_until);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_automation_rules_multiple_templates') THEN
CREATE INDEX idx_automation_rules_multiple_templates ON public.discount_automation_rules (uses_multiple_templates);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_automation_rules_programs') THEN
CREATE INDEX idx_automation_rules_programs ON public.discount_automation_rules USING GIN (applicable_programs);
END IF;
END $$;

-- Add indexes for automation_rule_discount_templates
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rule_templates_automation_rule') THEN
CREATE INDEX idx_rule_templates_automation_rule ON public.automation_rule_discount_templates (automation_rule_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rule_templates_discount_template') THEN
CREATE INDEX idx_rule_templates_discount_template ON public.automation_rule_discount_templates (discount_template_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_rule_templates_sequence') THEN
CREATE INDEX idx_rule_templates_sequence ON public.automation_rule_discount_templates (automation_rule_id, sequence_order);
END IF;
END $$;

-- Enable RLS for discount_automation_rules
ALTER TABLE public.discount_automation_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for discount_automation_rules
DO
$$
BEGIN
-- Allow admins to manage all automation rules
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage automation rules'
                         AND tablename = 'discount_automation_rules') THEN
CREATE POLICY "Allow admins to manage automation rules" ON public.discount_automation_rules
    FOR ALL USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    ) WITH CHECK (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;
END $$;

-- Enable RLS for automation_rule_discount_templates
ALTER TABLE public.automation_rule_discount_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automation_rule_discount_templates
DO
$$
BEGIN
-- Allow admins to manage all automation rule discount templates
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage automation rule discount templates'
                         AND tablename = 'automation_rule_discount_templates') THEN
CREATE POLICY "Allow admins to manage automation rule discount templates" ON public.automation_rule_discount_templates
    FOR ALL USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    ) WITH CHECK (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;
END $$;

-- Add trigger to update discount_automation_rules.updated_at
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1
                       FROM information_schema.triggers
                       WHERE trigger_name = 'discount_automation_rules_updated') THEN
CREATE TRIGGER discount_automation_rules_updated
    BEFORE UPDATE
    ON public.discount_automation_rules
    FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
END IF;
END $$;

-- Discount Assignments Table
CREATE TABLE IF NOT EXISTS public.discount_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_rule_id uuid NOT NULL REFERENCES public.discount_automation_rules(id) ON DELETE CASCADE,
    discount_event_id uuid NOT NULL REFERENCES public.discount_events(id) ON DELETE CASCADE,
    student_id uuid NULL REFERENCES public.students(id) ON DELETE CASCADE,
    family_id uuid NULL REFERENCES public.families(id) ON DELETE CASCADE,
    discount_code_id uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NULL
);

-- Add indexes for discount_assignments
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_assignments_student') THEN
CREATE INDEX idx_discount_assignments_student ON public.discount_assignments (student_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_assignments_family') THEN
CREATE INDEX idx_discount_assignments_family ON public.discount_assignments (family_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_assignments_rule') THEN
CREATE INDEX idx_discount_assignments_rule ON public.discount_assignments (automation_rule_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_assignments_event') THEN
CREATE INDEX idx_discount_assignments_event ON public.discount_assignments (discount_event_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_assignments_code') THEN
CREATE INDEX idx_discount_assignments_code ON public.discount_assignments (discount_code_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_assignments_assigned_at') THEN
CREATE INDEX idx_discount_assignments_assigned_at ON public.discount_assignments (assigned_at);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_discount_assignments_expires_at') THEN
CREATE INDEX idx_discount_assignments_expires_at ON public.discount_assignments (expires_at);
END IF;
END $$;

-- Enable RLS for discount_assignments
ALTER TABLE public.discount_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for discount_assignments
DO
$$
BEGIN
-- Allow users to view their own family's discount assignments
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow users to view own family discount assignments'
                         AND tablename = 'discount_assignments') THEN
CREATE POLICY "Allow users to view own family discount assignments" ON public.discount_assignments
    FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.family_id = family_id)
    );
END IF;

-- Allow admins to manage all discount assignments
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage discount assignments'
                         AND tablename = 'discount_assignments') THEN
CREATE POLICY "Allow admins to manage discount assignments" ON public.discount_assignments
    FOR ALL USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    ) WITH CHECK (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;

-- Allow system to insert discount assignments
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow system to insert discount assignments'
                         AND tablename = 'discount_assignments') THEN
CREATE POLICY "Allow system to insert discount assignments" ON public.discount_assignments
    FOR INSERT TO authenticated WITH CHECK (true); -- Controlled by application logic
END IF;
END $$;

-- --- End Automatic Discount Assignment System ---

-- --- End Discount Codes System ---

-- --- Multi-Class System ---

-- Programs Table
CREATE TABLE IF NOT EXISTS public.programs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text NULL,
    duration_minutes integer NOT NULL DEFAULT 60,
    -- Capacity constraints
    max_capacity integer NULL, -- Upper bound for all classes in this program
    -- Frequency constraints
    sessions_per_week integer NOT NULL DEFAULT 1, -- Required frequency
    min_sessions_per_week integer NULL, -- Optional minimum (for flexible programs)
    max_sessions_per_week integer NULL, -- Optional maximum (for flexible programs)
    -- Belt requirements
    min_belt_rank belt_rank_enum NULL, -- Minimum belt rank required
    max_belt_rank belt_rank_enum NULL, -- Maximum belt rank allowed
    belt_rank_required boolean NOT NULL DEFAULT false, -- Whether belt rank is enforced
    -- Prerequisite programs
    prerequisite_programs uuid[] NULL, -- Array of program IDs that must be completed first
    -- Age and demographic constraints
    min_age integer CHECK (min_age >= 0),
    max_age integer CHECK (max_age >= min_age),
    gender_restriction text DEFAULT 'none' CHECK (gender_restriction IN ('male', 'female', 'none')),
    special_needs_support boolean DEFAULT false,
    -- Pricing structure (stored as cents for precision)
    monthly_fee_cents INT4 NOT NULL DEFAULT 0,
    registration_fee_cents INT4 NOT NULL DEFAULT 0,
    yearly_fee_cents INT4 NOT NULL DEFAULT 0,
    individual_session_fee_cents INT4 NOT NULL DEFAULT 0,
    -- System fields
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    -- Constraints
    CHECK (min_sessions_per_week IS NULL OR min_sessions_per_week > 0),
    CHECK (max_sessions_per_week IS NULL OR max_sessions_per_week >= COALESCE(min_sessions_per_week, 1)),
    CHECK (sessions_per_week >= COALESCE(min_sessions_per_week, 1)),
    CHECK (sessions_per_week <= COALESCE(max_sessions_per_week, sessions_per_week))
);

-- Classes Table
CREATE TABLE IF NOT EXISTS public.classes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text NULL,
    max_capacity integer NULL,
    instructor_id uuid REFERENCES public.profiles(id),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Class Schedule Table - normalized approach with proper types
CREATE TABLE IF NOT EXISTS public.class_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    day_of_week day_of_week NOT NULL,
    start_time TIME NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(class_id, day_of_week, start_time) -- Prevent duplicate schedules
);

-- Enrollment Status Enum
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status') THEN
        CREATE TYPE enrollment_status AS ENUM ('active', 'inactive', 'completed', 'dropped', 'waitlist', 'trial');
    ELSE
        -- Add 'waitlist' to existing enum if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'waitlist' AND enumtypid = 'enrollment_status'::regtype) THEN
            ALTER TYPE enrollment_status ADD VALUE 'waitlist';
        END IF;
        -- Add 'trial' to existing enum if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'trial' AND enumtypid = 'enrollment_status'::regtype) THEN
            ALTER TYPE enrollment_status ADD VALUE 'trial';
        END IF;
    END IF;
END $$;

-- Enrollments Table
DO
$$
    BEGIN
        -- Create the table if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'enrollments' AND table_schema = 'public') THEN
            CREATE TABLE public.enrollments (
                                                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                                student_id uuid NOT NULL,
                                                class_id uuid NOT NULL,
                                                program_id uuid NOT NULL,
                                                status enrollment_status NOT NULL DEFAULT 'active',
                                                paid_until timestamptz,
                                                enrolled_at timestamptz NOT NULL DEFAULT now(),
                                                completed_at timestamptz NULL,
                                                dropped_at timestamptz NULL,
                                                notes text NULL,
                                                created_at timestamptz NOT NULL DEFAULT now(),
                                                updated_at timestamptz NOT NULL DEFAULT now()
            );
            RAISE NOTICE 'Created enrollments table';
        ELSE
            RAISE NOTICE 'Enrollments table already exists';
        END IF;

        -- Add missing columns if they don't exist (for repair scenarios)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enrollments' AND column_name = 'student_id' AND table_schema = 'public') THEN
            ALTER TABLE public.enrollments ADD COLUMN student_id uuid NOT NULL;
            RAISE NOTICE 'Added student_id column to enrollments';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enrollments' AND column_name = 'class_id' AND table_schema = 'public') THEN
            ALTER TABLE public.enrollments ADD COLUMN class_id uuid NOT NULL;
            RAISE NOTICE 'Added class_id column to enrollments';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enrollments' AND column_name = 'program_id' AND table_schema = 'public') THEN
            ALTER TABLE public.enrollments ADD COLUMN program_id uuid NOT NULL;
            RAISE NOTICE 'Added program_id column to enrollments';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enrollments' AND column_name = 'waivers_completed_at' AND table_schema = 'public') THEN
            ALTER TABLE public.enrollments ADD COLUMN waivers_completed_at timestamptz NULL;
            RAISE NOTICE 'Added waivers_completed_at column to enrollments';
        END IF;

        -- Add unique constraint if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_student_id_class_id_key' AND conrelid = 'public.enrollments'::regclass) THEN
            ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_student_id_class_id_key UNIQUE (student_id, class_id);
            RAISE NOTICE 'Added unique constraint on (student_id, class_id) to enrollments';
        END IF;

    END $$;

-- Add/Repair Foreign Key Constraints for Enrollments Table
DO
$$
    BEGIN
        -- Add enrollments -> students foreign key if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'enrollments'
              AND constraint_type = 'FOREIGN KEY'
              AND constraint_name = 'enrollments_student_id_fkey'
              AND table_schema = 'public'
        ) THEN
            ALTER TABLE public.enrollments
                ADD CONSTRAINT enrollments_student_id_fkey
                    FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added enrollments -> students foreign key';
        END IF;

        -- Add enrollments -> classes foreign key if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'enrollments'
              AND constraint_type = 'FOREIGN KEY'
              AND constraint_name = 'enrollments_class_id_fkey'
              AND table_schema = 'public'
        ) THEN
            ALTER TABLE public.enrollments
                ADD CONSTRAINT enrollments_class_id_fkey
                    FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added enrollments -> classes foreign key';
        END IF;

        -- Add enrollments -> programs foreign key if missing
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'enrollments'
              AND constraint_type = 'FOREIGN KEY'
              AND constraint_name = 'enrollments_program_id_fkey'
              AND table_schema = 'public'
        ) THEN
            ALTER TABLE public.enrollments
                ADD CONSTRAINT enrollments_program_id_fkey
                    FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE;
            RAISE NOTICE 'Added enrollments -> programs foreign key';
        END IF;

    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Error adding foreign keys to enrollments: %', SQLERRM;
    END $$;

-- Add indexes for programs
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_programs_active') THEN
CREATE INDEX idx_programs_active ON public.programs (is_active);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_programs_monthly_fee_cents') THEN
CREATE INDEX idx_programs_monthly_fee_cents ON public.programs (monthly_fee_cents);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_programs_yearly_fee_cents') THEN
CREATE INDEX idx_programs_yearly_fee_cents ON public.programs (yearly_fee_cents);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_programs_session_fee_cents') THEN
CREATE INDEX idx_programs_session_fee_cents ON public.programs (individual_session_fee_cents);
END IF;
-- New indexes for multi-class system
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_programs_max_capacity') THEN
CREATE INDEX idx_programs_max_capacity ON public.programs (max_capacity);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_programs_sessions_per_week') THEN
CREATE INDEX idx_programs_sessions_per_week ON public.programs (sessions_per_week);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_programs_belt_ranks') THEN
CREATE INDEX idx_programs_belt_ranks ON public.programs (min_belt_rank, max_belt_rank);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_programs_prerequisites') THEN
CREATE INDEX idx_programs_prerequisites ON public.programs USING GIN (prerequisite_programs);
END IF;
END $$;

-- Add indexes for classes
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_classes_program') THEN
CREATE INDEX idx_classes_program ON public.classes (program_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_classes_active') THEN
CREATE INDEX idx_classes_active ON public.classes (is_active);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_classes_capacity') THEN
CREATE INDEX idx_classes_capacity ON public.classes (max_capacity);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_classes_instructor') THEN
CREATE INDEX idx_classes_instructor ON public.classes (instructor_id);
END IF;
-- Indexes for class_schedules table
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_class_schedules_class_id') THEN
CREATE INDEX idx_class_schedules_class_id ON public.class_schedules (class_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_class_schedules_day_time') THEN
CREATE INDEX idx_class_schedules_day_time ON public.class_schedules (day_of_week, start_time);
END IF;
END $$;

-- Add indexes for enrollments
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_enrollments_student') THEN
CREATE INDEX idx_enrollments_student ON public.enrollments (student_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_enrollments_class') THEN
CREATE INDEX idx_enrollments_class ON public.enrollments (class_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_enrollments_program') THEN
CREATE INDEX idx_enrollments_program ON public.enrollments (program_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_enrollments_status') THEN
CREATE INDEX idx_enrollments_status ON public.enrollments (status);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_enrollments_enrolled_at') THEN
CREATE INDEX idx_enrollments_enrolled_at ON public.enrollments (enrolled_at);
END IF;
END $$;

-- Enable RLS for programs
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for programs
DO
$$
BEGIN
-- Allow everyone to view active programs
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow everyone to view active programs'
                         AND tablename = 'programs') THEN
CREATE POLICY "Allow everyone to view active programs" ON public.programs
    FOR SELECT TO authenticated USING (is_active = true);
END IF;

-- Allow admins to manage all programs
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage programs'
                         AND tablename = 'programs') THEN
CREATE POLICY "Allow admins to manage programs" ON public.programs
    FOR ALL USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    ) WITH CHECK (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;
END $$;

-- Enable RLS for classes
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for classes
DO
$$
BEGIN
-- Allow everyone to view active classes
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow everyone to view active classes'
                         AND tablename = 'classes') THEN
CREATE POLICY "Allow everyone to view active classes" ON public.classes
    FOR SELECT TO authenticated USING (is_active = true);
END IF;

-- Allow admins to manage all classes
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage classes'
                         AND tablename = 'classes') THEN
CREATE POLICY "Allow admins to manage classes" ON public.classes
    FOR ALL USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    ) WITH CHECK (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;
END $$;

-- Class Sessions Table - individual session occurrences
CREATE TABLE IF NOT EXISTS public.class_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    instructor_id uuid REFERENCES public.profiles(id),
    notes TEXT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(class_id, session_date, start_time) -- Prevent duplicate sessions
);

-- Add indexes for class_sessions
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_class_sessions_class_id') THEN
CREATE INDEX idx_class_sessions_class_id ON public.class_sessions (class_id);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_class_sessions_date') THEN
CREATE INDEX idx_class_sessions_date ON public.class_sessions (session_date);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_class_sessions_status') THEN
CREATE INDEX idx_class_sessions_status ON public.class_sessions (status);
END IF;
IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_class_sessions_instructor') THEN
CREATE INDEX idx_class_sessions_instructor ON public.class_sessions (instructor_id);
END IF;
END $$;

-- Enable RLS for class_schedules
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for class_schedules
DO
$$
BEGIN
-- Allow everyone to view schedules for active classes
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow everyone to view class schedules'
                         AND tablename = 'class_schedules') THEN
CREATE POLICY "Allow everyone to view class schedules" ON public.class_schedules
    FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1
            FROM public.classes c
            WHERE c.id = class_id
              AND c.is_active = true)
    );
END IF;

-- Allow admins to manage all class schedules
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage class schedules'
                         AND tablename = 'class_schedules') THEN
CREATE POLICY "Allow admins to manage class schedules" ON public.class_schedules
    FOR ALL USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    ) WITH CHECK (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;
END $$;

-- Enable RLS for class_sessions
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for class_sessions
DO
$$
BEGIN
-- Allow families to view sessions for classes their students are enrolled in
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow families to view enrolled class sessions'
                         AND tablename = 'class_sessions') THEN
CREATE POLICY "Allow families to view enrolled class sessions" ON public.class_sessions
    FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1
            FROM public.enrollments e
                     JOIN public.students s ON s.id = e.student_id
                     JOIN public.profiles p ON p.family_id = s.family_id
            WHERE e.class_id = class_sessions.class_id
              AND e.status = 'active'
              AND p.id = auth.uid())
    );
END IF;

-- Allow admins to manage all class sessions
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage class sessions'
                         AND tablename = 'class_sessions') THEN
CREATE POLICY "Allow admins to manage class sessions" ON public.class_sessions
    FOR ALL USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    ) WITH CHECK (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;
END $$;

-- Attendance table (session-based tracking)
CREATE TABLE IF NOT EXISTS public.attendance
(
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id       uuid REFERENCES public.students (id) ON DELETE CASCADE NOT NULL,
    class_session_id uuid REFERENCES public.class_sessions (id) ON DELETE CASCADE NOT NULL,
    status           text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    notes            text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT attendance_session_student_unique UNIQUE (class_session_id, student_id)
);

-- Add columns to existing table if they don't exist (for migration compatibility)
DO
$$
    BEGIN
        -- Add class_session_id column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'attendance' AND column_name = 'class_session_id') THEN
            ALTER TABLE public.attendance 
                ADD COLUMN class_session_id uuid REFERENCES public.class_sessions (id) ON DELETE CASCADE;
        END IF;
        
        -- Add status column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'attendance' AND column_name = 'status') THEN
            ALTER TABLE public.attendance 
                ADD COLUMN status text CHECK (status IN ('present', 'absent', 'late', 'excused'));
        END IF;
        
        -- Drop old constraint if it exists
        IF EXISTS (SELECT 1 FROM pg_constraint 
                  WHERE conname = 'attendance_class_date_student_id_key' 
                    AND conrelid = 'public.attendance'::regclass) THEN
            ALTER TABLE public.attendance DROP CONSTRAINT attendance_class_date_student_id_key;
        END IF;
        
        -- Drop class_date column if it exists (after ensuring data migration)
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'attendance' AND column_name = 'class_date') THEN
            -- Note: In production, you should migrate data before dropping the column
            ALTER TABLE public.attendance DROP COLUMN class_date;
        END IF;
        
        -- Drop present column if it exists (replaced by status)
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'attendance' AND column_name = 'present') THEN
            -- Note: In production, you should migrate data before dropping the column
            ALTER TABLE public.attendance DROP COLUMN present;
        END IF;
    END
$$;

-- Add indexes for attendance
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1
                       FROM pg_indexes
                       WHERE indexname = 'idx_attendance_student_id') THEN
            CREATE INDEX idx_attendance_student_id ON public.attendance (student_id);
        END IF;
    END
$$;

DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1
                       FROM pg_indexes
                       WHERE indexname = 'idx_attendance_class_session_id') THEN
            CREATE INDEX idx_attendance_class_session_id ON public.attendance (class_session_id);
        END IF;
    END
$$;

-- Ensure the new unique constraint exists
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1
                       FROM pg_constraint
                       WHERE conname = 'attendance_session_student_unique'
                         AND conrelid = 'public.attendance'::regclass) THEN
            ALTER TABLE public.attendance
                ADD CONSTRAINT attendance_session_student_unique UNIQUE (class_session_id, student_id);
        END IF;
    END;
$$;

-- Enable RLS for attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Enable RLS for enrollments
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for enrollments
DO
$$
BEGIN
-- Allow users to view their own family's enrollments
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow users to view own family enrollments'
                         AND tablename = 'enrollments') THEN
CREATE POLICY "Allow users to view own family enrollments" ON public.enrollments
    FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1
            FROM public.students s
                     JOIN public.profiles p ON p.family_id = s.family_id
            WHERE s.id = student_id
              AND p.id = auth.uid())
    );
END IF;

-- Allow admins to manage all enrollments
IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage enrollments'
                         AND tablename = 'enrollments') THEN
CREATE POLICY "Allow admins to manage enrollments" ON public.enrollments
    FOR ALL USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    ) WITH CHECK (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );
END IF;
END $$;

-- Add triggers to update timestamps
DO
$$
BEGIN
IF NOT EXISTS (SELECT 1
                       FROM information_schema.triggers
                       WHERE trigger_name = 'programs_updated') THEN
CREATE TRIGGER programs_updated
    BEFORE UPDATE
    ON public.programs
    FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
END IF;

IF NOT EXISTS (SELECT 1
                       FROM information_schema.triggers
                       WHERE trigger_name = 'classes_updated') THEN
CREATE TRIGGER classes_updated
    BEFORE UPDATE
    ON public.classes
    FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
END IF;

IF NOT EXISTS (SELECT 1
                       FROM information_schema.triggers
                       WHERE trigger_name = 'enrollments_updated') THEN
CREATE TRIGGER enrollments_updated
    BEFORE UPDATE
    ON public.enrollments
    FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
END IF;

IF NOT EXISTS (SELECT 1
                       FROM information_schema.triggers
                       WHERE trigger_name = 'class_sessions_updated') THEN
CREATE TRIGGER class_sessions_updated
    BEFORE UPDATE
    ON public.class_sessions
    FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
END IF;

IF NOT EXISTS (SELECT 1
                       FROM information_schema.triggers
                       WHERE trigger_name = 'attendance_updated') THEN
CREATE TRIGGER attendance_updated
    BEFORE UPDATE
    ON public.attendance
    FOR EACH ROW
EXECUTE FUNCTION update_modified_column();
END IF;
END $$;

-- Note: Removed enrollment count trigger and function since current_enrollment column
-- was removed from classes table. Enrollment counts are now calculated dynamically.

-- Drop the problematic trigger and function if they exist
DROP TRIGGER IF EXISTS trigger_update_class_enrollment_count ON public.enrollments;
DROP TRIGGER IF EXISTS enrollment_count_trigger ON public.enrollments;
DROP FUNCTION IF EXISTS update_class_enrollment_count() CASCADE;

-- Function to generate class sessions based on class_schedules table
DROP FUNCTION IF EXISTS generate_class_sessions(uuid,date,date);
CREATE OR REPLACE FUNCTION generate_class_sessions(
    p_class_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS INTEGER AS $$
DECLARE
    schedule_record RECORD;
    date_record RECORD;
    end_time TIME;
    duration_minutes INTEGER;
    sessions_created INTEGER := 0;
BEGIN
    -- Get program duration
    SELECT p.duration_minutes INTO duration_minutes
    FROM programs p
    JOIN classes c ON c.program_id = p.id
    WHERE c.id = p_class_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Class not found: %', p_class_id;
    END IF;
    
    -- Delete existing sessions in the date range
    DELETE FROM class_sessions 
    WHERE class_id = p_class_id 
    AND session_date BETWEEN p_start_date AND p_end_date;
    
    -- Generate sessions for each schedule entry
    FOR schedule_record IN 
        SELECT day_of_week, start_time
        FROM class_schedules
        WHERE class_id = p_class_id
    LOOP
        end_time := schedule_record.start_time + (duration_minutes || ' minutes')::INTERVAL;
        
        -- Generate sessions for this day/time combination
        FOR date_record IN 
            SELECT d::date as session_date
            FROM generate_series(p_start_date, p_end_date, '1 day'::interval) d
            WHERE TRIM(LOWER(to_char(d, 'day'))) = TRIM(schedule_record.day_of_week::text)
        LOOP
            INSERT INTO class_sessions (
                class_id,
                session_date,
                start_time,
                end_time,
                status
            ) VALUES (
                p_class_id,
                date_record.session_date,
                schedule_record.start_time,
                end_time,
                'scheduled'
            );
            sessions_created := sessions_created + 1;
        END LOOP;
    END LOOP;
    
    RETURN sessions_created;
END;
$$ LANGUAGE plpgsql;

-- Insert sample programs
/*INSERT INTO public.programs (name, description, age_group, belt_system, duration_weeks, monthly_fee_cents, registration_fee_cents, payment_frequency, family_discount_cents, min_age, max_age, gender_restriction, special_needs_support, is_active)
VALUES 
    ('Little Dragons', 'Martial arts program for young children focusing on basic movements, discipline, and fun', 'Kids (4-6)', 'Traditional', 12, 8000, 5000, 'monthly', 1000, 4, 6, 'none', true, true),
    ('Youth Karate', 'Traditional karate training for children and teens', 'Kids (7-12)', 'Traditional', 16, 9000, 7500, 'monthly', 1500, 7, 12, 'none', true, true),
    ('Teen Martial Arts', 'Advanced martial arts training for teenagers', 'Teens (13-17)', 'Traditional', 20, 10000, 7500, 'monthly', 1500, 13, 17, 'none', false, true),
    ('Adult Karate', 'Traditional karate training for adults of all skill levels', 'Adults (18+)', 'Traditional', 24, 11000, 10000, 'monthly', 2000, 18, NULL, 'none', false, true),
    ('Competition Team', 'Advanced training for students interested in martial arts competitions', 'All Ages', 'Competition', 52, 15000, 15000, 'monthly', 2500, 8, NULL, 'none', false, true)
ON CONFLICT DO NOTHING;*/

-- Insert sample classes
/*INSERT INTO public.classes (program_id, name, description, instructor, max_capacity, is_active)
SELECT 
    p.id,
    p.name || ' - ' || schedule.time_slot,
    'Regular class for ' || p.name || ' program',
    schedule.instructor,
    schedule.capacity,
    true
FROM public.programs p
CROSS JOIN (
    VALUES 
        ('Morning MWF', 'Sensei Johnson', 15),
        ('Evening MWF', 'Sensei Smith', 20),
        ('Saturday Morning', 'Sensei Davis', 25),
        ('Tuesday Evening', 'Sensei Johnson', 18),
        ('Thursday Evening', 'Sensei Smith', 18)
) AS schedule(time_slot, instructor, capacity)
WHERE p.name IN ('Little Dragons', 'Youth Karate', 'Adult Karate')
ON CONFLICT DO NOTHING;*/

-- Insert sample class schedules
/*INSERT INTO public.class_schedules (class_id, day_of_week, start_time)
SELECT 
    c.id,
    schedule_data.day_of_week::day_of_week,
    schedule_data.start_time::TIME
FROM public.classes c
CROSS JOIN (
    VALUES 
        ('Morning MWF', 'monday', '09:00'),
        ('Morning MWF', 'wednesday', '09:00'),
        ('Morning MWF', 'friday', '09:00'),
        ('Evening MWF', 'monday', '18:00'),
        ('Evening MWF', 'wednesday', '18:00'),
        ('Evening MWF', 'friday', '18:00'),
        ('Saturday Morning', 'saturday', '10:00'),
        ('Tuesday Evening', 'tuesday', '18:30'),
        ('Thursday Evening', 'thursday', '18:30')
) AS schedule_data(time_slot, day_of_week, start_time)
WHERE c.name LIKE '%' || schedule_data.time_slot
ON CONFLICT DO NOTHING;*/

-- Helper functions for multi-class system

-- Function to convert belt rank enum to ordinal number for comparison
CREATE OR REPLACE FUNCTION belt_rank_ordinal(rank belt_rank_enum)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE rank
        WHEN 'white' THEN 1
        WHEN 'yellow' THEN 2
        WHEN 'orange' THEN 3
        WHEN 'green' THEN 4
        WHEN 'blue' THEN 5
        WHEN 'purple' THEN 6
        WHEN 'red' THEN 7
        WHEN 'brown' THEN 8
        WHEN 'black' THEN 9
        ELSE 0
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get student's current belt rank
CREATE OR REPLACE FUNCTION get_student_current_belt_rank(student_id_param UUID)
RETURNS belt_rank_enum AS $$
DECLARE
    current_rank belt_rank_enum;
BEGIN
    SELECT belt_rank INTO current_rank
    FROM belt_awards
    WHERE student_id = student_id_param
    ORDER BY awarded_date DESC
    LIMIT 1;
    
    -- Return white belt if no awards found
    RETURN COALESCE(current_rank, 'white');
END;
$$ LANGUAGE plpgsql;

-- Function to check if student meets program eligibility requirements
CREATE OR REPLACE FUNCTION check_program_eligibility(
    student_id_param UUID,
    program_id_param UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    student_record RECORD;
    program_record RECORD;
    current_belt belt_rank_enum;
    current_belt_ordinal INTEGER;
    min_belt_ordinal INTEGER;
    max_belt_ordinal INTEGER;
    prerequisite_id UUID;
    prerequisite_completed BOOLEAN;
BEGIN
    -- Get student information
    SELECT birth_date, gender, special_needs INTO student_record
    FROM students
    WHERE id = student_id_param;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Get program requirements
    SELECT 
        min_age, max_age,
        min_belt_rank, max_belt_rank, belt_rank_required,
        prerequisite_programs,
        gender_restriction,
        special_needs_support
    INTO program_record
    FROM programs
    WHERE id = program_id_param AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check age requirements
    IF program_record.min_age IS NOT NULL THEN
        IF EXTRACT(YEAR FROM AGE(student_record.birth_date)) < program_record.min_age THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    IF program_record.max_age IS NOT NULL THEN
        IF EXTRACT(YEAR FROM AGE(student_record.birth_date)) > program_record.max_age THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Check gender restrictions
    IF program_record.gender_restriction IS NOT NULL AND program_record.gender_restriction != 'none' THEN
        IF student_record.gender IS NULL OR student_record.gender != program_record.gender_restriction THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    -- Check special needs support
    IF student_record.special_needs IS NOT NULL AND student_record.special_needs != '' AND program_record.special_needs_support = false THEN
        RETURN FALSE;
    END IF;
    
    -- Check belt rank requirements if enforced
    IF program_record.belt_rank_required THEN
        current_belt := get_student_current_belt_rank(student_id_param);
        current_belt_ordinal := belt_rank_ordinal(current_belt);
        
        IF program_record.min_belt_rank IS NOT NULL THEN
            min_belt_ordinal := belt_rank_ordinal(program_record.min_belt_rank);
            IF current_belt_ordinal < min_belt_ordinal THEN
                RETURN FALSE;
            END IF;
        END IF;
        
        IF program_record.max_belt_rank IS NOT NULL THEN
            max_belt_ordinal := belt_rank_ordinal(program_record.max_belt_rank);
            IF current_belt_ordinal > max_belt_ordinal THEN
                RETURN FALSE;
            END IF;
        END IF;
    END IF;
    
    -- Check prerequisite programs
    IF program_record.prerequisite_programs IS NOT NULL THEN
        FOREACH prerequisite_id IN ARRAY program_record.prerequisite_programs
        LOOP
            SELECT EXISTS(
                SELECT 1 FROM enrollments e
                WHERE e.student_id = student_id_param
                AND e.program_id = prerequisite_id
                AND e.status = 'completed'
            ) INTO prerequisite_completed;
            
            IF NOT prerequisite_completed THEN
                RETURN FALSE;
            END IF;
        END LOOP;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if student meets class eligibility requirements (program + capacity)
CREATE OR REPLACE FUNCTION check_class_eligibility(
    student_id_param UUID,
    class_id_param UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    program_id_var UUID;
    current_enrollment_count INTEGER;
    class_max_capacity INTEGER;
BEGIN
    -- Get class information
    SELECT program_id, max_capacity INTO program_id_var, class_max_capacity
    FROM classes
    WHERE id = class_id_param AND is_active = true;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- First check program eligibility
    IF NOT check_program_eligibility(student_id_param, program_id_var) THEN
        RETURN FALSE;
    END IF;
    
    -- Check class capacity if set
    IF class_max_capacity IS NOT NULL THEN
        -- Count current active enrollments for this class
        SELECT COUNT(*) INTO current_enrollment_count
        FROM enrollments
        WHERE class_id = class_id_param 
        AND status IN ('active', 'waitlist');
        
        -- Check if class is at capacity
        IF current_enrollment_count >= class_max_capacity THEN
            RETURN FALSE;
        END IF;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to validate class capacity against program capacity
CREATE OR REPLACE FUNCTION validate_class_capacity()
RETURNS TRIGGER AS $$
DECLARE
    program_max_capacity INTEGER;
BEGIN
    -- Get program max capacity
    SELECT max_capacity INTO program_max_capacity
    FROM programs
    WHERE id = NEW.program_id;
    
    -- If program has max capacity and class capacity exceeds it, raise error
    IF program_max_capacity IS NOT NULL AND NEW.max_capacity IS NOT NULL THEN
        IF NEW.max_capacity > program_max_capacity THEN
            RAISE EXCEPTION 'Class capacity (%) cannot exceed program max capacity (%)', 
                NEW.max_capacity, program_max_capacity;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to validate class capacity
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_class_capacity_trigger') THEN
        CREATE TRIGGER validate_class_capacity_trigger
            BEFORE INSERT OR UPDATE ON public.classes
            FOR EACH ROW
            EXECUTE FUNCTION validate_class_capacity();
    END IF;
END
$$;

-- Trigger function to validate class schedule frequency against program requirements
CREATE OR REPLACE FUNCTION validate_class_schedule_frequency()
RETURNS TRIGGER AS $$
DECLARE
    program_record RECORD;
    schedule_count INTEGER;
BEGIN
    -- Get program frequency requirements
    SELECT 
        sessions_per_week,
        min_sessions_per_week,
        max_sessions_per_week
    INTO program_record
    FROM programs p
    JOIN classes c ON c.program_id = p.id
    WHERE c.id = NEW.class_id;
    
    -- Count current schedules for this class
    SELECT COUNT(*) INTO schedule_count
    FROM class_schedules
    WHERE class_id = NEW.class_id;
    
    -- Skip validation for pay-per-session programs (no subscription commitment)
    IF program_record.sessions_per_week = 0 THEN
        RETURN NEW;
    END IF;
    
    -- Validate against frequency constraints
    IF program_record.min_sessions_per_week IS NOT NULL THEN
        IF schedule_count < program_record.min_sessions_per_week THEN
            RAISE EXCEPTION 'Class must have at least % sessions per week', 
                program_record.min_sessions_per_week;
        END IF;
    END IF;
    
    IF program_record.max_sessions_per_week IS NOT NULL THEN
        IF schedule_count > program_record.max_sessions_per_week THEN
            RAISE EXCEPTION 'Class cannot have more than % sessions per week', 
                program_record.max_sessions_per_week;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to validate class schedule frequency
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_schedule_frequency_trigger') THEN
        CREATE TRIGGER validate_schedule_frequency_trigger
            AFTER INSERT OR UPDATE OR DELETE ON public.class_schedules
            FOR EACH ROW
            EXECUTE FUNCTION validate_class_schedule_frequency();
    END IF;
END
$$;

-- --- End Multi-Class System ---

-- Push Notifications Table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient user lookups
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Enable RLS for push_subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for push_subscriptions
DO
$$
BEGIN
    -- Allow users to manage their own push subscriptions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own push subscriptions' AND tablename = 'push_subscriptions') THEN
        CREATE POLICY "Users can manage their own push subscriptions" ON public.push_subscriptions
            FOR ALL USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
    END IF;

    -- Allow admins to manage all push subscriptions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow admins to manage push subscriptions' AND tablename = 'push_subscriptions') THEN
        CREATE POLICY "Allow admins to manage push subscriptions" ON public.push_subscriptions
            FOR ALL USING (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
            ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
            );
    END IF;
END
$$;

-- Add update timestamp trigger for push_subscriptions table
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'push_subscriptions_updated') THEN
        CREATE TRIGGER push_subscriptions_updated
            BEFORE UPDATE ON public.push_subscriptions
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
    END IF;
END
$$;

-- --- Invoice System ---

-- Create invoice_status enum
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
            CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'cancelled');
        END IF;
    END
$$;

-- Create invoice_payment_method enum  
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_payment_method') THEN
            CREATE TYPE invoice_payment_method AS ENUM ('cash', 'check', 'bank_transfer', 'credit_card', 'ach', 'other');
        END IF;
    END
$$;

-- Create invoice_item_type enum
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_item_type') THEN
            CREATE TYPE invoice_item_type AS ENUM ('class_enrollment', 'individual_session', 'product', 'fee', 'discount', 'other');
        END IF;
    END
$$;

-- Create invoice_entities table
CREATE TABLE IF NOT EXISTS invoice_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    entity_type entity_type_enum NOT NULL,
    contact_person VARCHAR,
    email VARCHAR,
    phone VARCHAR,
    address_line1 VARCHAR,
    address_line2 VARCHAR,
    city VARCHAR,
    state VARCHAR,
    postal_code VARCHAR,
    country VARCHAR DEFAULT 'US',
    tax_id VARCHAR,
    payment_terms VARCHAR DEFAULT 'Net 30' CHECK (payment_terms IN ('Due on Receipt', 'Net 15', 'Net 30', 'Net 60', 'Net 90')),
    credit_limit_cents INTEGER, -- Migrated from DECIMAL(10,2) to INT4 cents storage
    family_id UUID REFERENCES families(id),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR UNIQUE NOT NULL,
    entity_id UUID NOT NULL REFERENCES invoice_entities(id),
    family_id UUID REFERENCES families(id),
    status invoice_status DEFAULT 'draft',
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    service_period_start DATE,
    service_period_end DATE,
    subtotal_cents INTEGER NOT NULL DEFAULT 0, -- Migrated from DECIMAL(10,2) to INT4 cents storage
    tax_amount_cents INTEGER NOT NULL DEFAULT 0, -- Migrated from DECIMAL(10,2) to INT4 cents storage
    discount_amount_cents INTEGER NOT NULL DEFAULT 0, -- Migrated from DECIMAL(10,2) to INT4 cents storage
    total_amount_cents INTEGER NOT NULL DEFAULT 0, -- Migrated from DECIMAL(10,2) to INT4 cents storage
    amount_paid_cents INTEGER NOT NULL DEFAULT 0, -- Migrated from DECIMAL(10,2) to INT4 cents storage
    amount_due_cents INTEGER NOT NULL DEFAULT 0, -- Migrated from DECIMAL(10,2) to INT4 cents storage
    currency VARCHAR(3) DEFAULT 'CAD',
    notes TEXT,
    terms TEXT,
    footer_text TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    viewed_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoice_line_items table
CREATE TABLE IF NOT EXISTS invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_type invoice_item_type NOT NULL,
    description TEXT NOT NULL,
    quantity_cents INTEGER NOT NULL DEFAULT 100, -- Migrated from DECIMAL(10,2) to INT4 cents storage (1.00 = 100 cents)
    unit_price_cents INTEGER NOT NULL, -- Migrated from DECIMAL(10,2) to INT4 cents storage
    line_total_cents INTEGER NOT NULL, -- Migrated from DECIMAL(10,2) to INT4 cents storage
    discount_rate DECIMAL(5,4) DEFAULT 0, -- Keep as DECIMAL for percentage rates
    discount_amount_cents INTEGER DEFAULT 0, -- Migrated from DECIMAL(10,2) to INT4 cents storage
    enrollment_id UUID REFERENCES enrollments(id),
    product_id UUID,
    service_period_start DATE,
    service_period_end DATE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoice_line_item_taxes junction table for multiple tax rates per line item
CREATE TABLE IF NOT EXISTS invoice_line_item_taxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_item_id UUID NOT NULL REFERENCES invoice_line_items(id) ON DELETE CASCADE,
    tax_rate_id UUID NOT NULL REFERENCES tax_rates(id) ON DELETE CASCADE,
    tax_amount_cents INTEGER NOT NULL, -- Migrated from DECIMAL(10,2) to INT4 cents storage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(line_item_id, tax_rate_id)
);

-- Create invoice_payments table
CREATE TABLE IF NOT EXISTS invoice_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    payment_method invoice_payment_method NOT NULL,
    amount_cents INTEGER NOT NULL, -- Migrated from DECIMAL(10,2) to INT4 cents storage
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference_number VARCHAR,
    notes TEXT,
    receipt_url VARCHAR,
    stripe_payment_intent_id VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoice_status_history table
CREATE TABLE IF NOT EXISTS invoice_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    old_status invoice_status,
    new_status invoice_status NOT NULL,
    changed_by UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoice_payment_taxes table for tracking tax breakdown in invoice payments
CREATE TABLE IF NOT EXISTS invoice_payment_taxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_payment_id UUID NOT NULL REFERENCES invoice_payments(id) ON DELETE CASCADE,
    tax_rate_id UUID NOT NULL REFERENCES tax_rates(id) ON DELETE RESTRICT,
    tax_amount_cents INTEGER NOT NULL CHECK (tax_amount_cents >= 0), -- Migrated from DECIMAL(10,2) to INT4 cents storage
    tax_rate_snapshot DECIMAL(5,4) NOT NULL,
    tax_name_snapshot VARCHAR NOT NULL,
    tax_description_snapshot TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoice_entities_entity_type') THEN
        CREATE INDEX idx_invoice_entities_entity_type ON invoice_entities(entity_type);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoice_entities_is_active') THEN
        CREATE INDEX idx_invoice_entities_is_active ON invoice_entities(is_active);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoice_entities_family_id') THEN
        CREATE INDEX idx_invoice_entities_family_id ON invoice_entities(family_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoices_entity_id') THEN
        CREATE INDEX idx_invoices_entity_id ON invoices(entity_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoices_family_id') THEN
        CREATE INDEX idx_invoices_family_id ON invoices(family_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoices_status') THEN
        CREATE INDEX idx_invoices_status ON invoices(status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoices_issue_date') THEN
        CREATE INDEX idx_invoices_issue_date ON invoices(issue_date);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoices_due_date') THEN
        CREATE INDEX idx_invoices_due_date ON invoices(due_date);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoices_invoice_number') THEN
        CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoice_line_items_invoice_id') THEN
        CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoice_line_items_enrollment_id') THEN
        CREATE INDEX idx_invoice_line_items_enrollment_id ON invoice_line_items(enrollment_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoice_line_item_taxes_line_item_id') THEN
        CREATE INDEX idx_invoice_line_item_taxes_line_item_id ON invoice_line_item_taxes(line_item_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoice_line_item_taxes_tax_rate_id') THEN
        CREATE INDEX idx_invoice_line_item_taxes_tax_rate_id ON invoice_line_item_taxes(tax_rate_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoice_payments_invoice_id') THEN
        CREATE INDEX idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoice_payments_payment_date') THEN
        CREATE INDEX idx_invoice_payments_payment_date ON invoice_payments(payment_date);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoice_payment_taxes_payment_id') THEN
        CREATE INDEX idx_invoice_payment_taxes_payment_id ON invoice_payment_taxes(invoice_payment_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoice_payment_taxes_tax_rate_id') THEN
        CREATE INDEX idx_invoice_payment_taxes_tax_rate_id ON invoice_payment_taxes(tax_rate_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoice_status_history_invoice_id') THEN
        CREATE INDEX idx_invoice_status_history_invoice_id ON invoice_status_history(invoice_id);
    END IF;
END
$$;

-- Create function for generating invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR AS $$
DECLARE
    current_year VARCHAR(4);
    next_number INTEGER;
    new_invoice_number VARCHAR;  -- Renamed to avoid ambiguity
BEGIN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
    
    -- Get the next sequential number for this year
    -- Explicitly qualify the column reference with table name
    SELECT COALESCE(MAX(
        CASE 
            WHEN invoices.invoice_number ~ ('^INV-' || current_year || '-[0-9]+$')
            THEN CAST(SUBSTRING(invoices.invoice_number FROM LENGTH('INV-' || current_year || '-') + 1) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO next_number
    FROM invoices;
    
    -- Format: INV-YYYY-NNNN (e.g., INV-2025-0001)
    new_invoice_number := 'INV-' || current_year || '-' || LPAD(next_number::VARCHAR, 4, '0');
    
    RETURN new_invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate invoice numbers
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_set_invoice_number') THEN
        CREATE TRIGGER trigger_set_invoice_number
            BEFORE INSERT ON invoices
            FOR EACH ROW
            EXECUTE FUNCTION set_invoice_number();
    END IF;
END
$$;

-- Create trigger to update invoice totals when line items change
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
    invoice_subtotal_cents INTEGER;
    invoice_tax_amount_cents INTEGER;
    invoice_discount_amount_cents INTEGER;
    invoice_total_cents INTEGER;
    invoice_amount_paid_cents INTEGER;
BEGIN
    -- Calculate totals from line items (all in cents)
    SELECT 
        COALESCE(SUM(line_total_cents), 0),
        COALESCE(SUM(tax_amount_cents), 0),
        COALESCE(SUM(discount_amount_cents), 0)
    INTO invoice_subtotal_cents, invoice_tax_amount_cents, invoice_discount_amount_cents
    FROM invoice_line_items 
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Calculate total amount (in cents)
    invoice_total_cents := invoice_subtotal_cents + invoice_tax_amount_cents - invoice_discount_amount_cents;
    
    -- Get amount paid (in cents)
    SELECT COALESCE(SUM(amount_cents), 0)
    INTO invoice_amount_paid_cents
    FROM invoice_payments
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Update invoice totals (all in cents)
    UPDATE invoices SET
        subtotal_cents = invoice_subtotal_cents,
        tax_amount_cents = invoice_tax_amount_cents,
        discount_amount_cents = invoice_discount_amount_cents,
        total_amount_cents = invoice_total_cents,
        amount_paid_cents = invoice_amount_paid_cents,
        amount_due_cents = invoice_total_cents - invoice_amount_paid_cents,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_invoice_totals_on_line_items') THEN
        CREATE TRIGGER trigger_update_invoice_totals_on_line_items
            AFTER INSERT OR UPDATE OR DELETE ON invoice_line_items
            FOR EACH ROW
            EXECUTE FUNCTION update_invoice_totals();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_invoice_totals_on_payments') THEN
        CREATE TRIGGER trigger_update_invoice_totals_on_payments
            AFTER INSERT OR UPDATE OR DELETE ON invoice_payments
            FOR EACH ROW
            EXECUTE FUNCTION update_invoice_totals();
    END IF;
END
$$;

-- Create trigger to track status changes
CREATE OR REPLACE FUNCTION track_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO invoice_status_history (invoice_id, old_status, new_status, notes)
        VALUES (NEW.id, OLD.status, NEW.status, 'Status changed automatically');
        
        -- Update timestamp fields based on status
        IF NEW.status = 'sent' AND OLD.status = 'draft' THEN
            NEW.sent_at := NOW();
        ELSIF NEW.status = 'viewed' AND NEW.viewed_at IS NULL THEN
            NEW.viewed_at := NOW();
        ELSIF NEW.status = 'paid' THEN
            NEW.paid_at := NOW();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_track_invoice_status_change') THEN
        CREATE TRIGGER trigger_track_invoice_status_change
            BEFORE UPDATE ON invoices
            FOR EACH ROW
            EXECUTE FUNCTION track_invoice_status_change();
    END IF;
END
$$;

-- Create updated_at triggers for invoice tables
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_invoices_updated_at') THEN
        CREATE TRIGGER trigger_invoices_updated_at
            BEFORE UPDATE ON invoices
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_invoice_entities_updated_at') THEN
        CREATE TRIGGER trigger_invoice_entities_updated_at
            BEFORE UPDATE ON invoice_entities
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_invoice_payments_updated_at') THEN
        CREATE TRIGGER trigger_invoice_payments_updated_at
            BEFORE UPDATE ON invoice_payments
            FOR EACH ROW
            EXECUTE FUNCTION update_modified_column();
    END IF;
END
$$;

-- Add RLS (Row Level Security) policies
ALTER TABLE invoice_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoice_entities
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view all invoice entities' AND tablename = 'invoice_entities') THEN
        CREATE POLICY "Users can view all invoice entities" ON invoice_entities
            FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can insert invoice entities' AND tablename = 'invoice_entities') THEN
        CREATE POLICY "Authenticated users can insert invoice entities" ON invoice_entities
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can update invoice entities' AND tablename = 'invoice_entities') THEN
        CREATE POLICY "Authenticated users can update invoice entities" ON invoice_entities
            FOR UPDATE USING (auth.role() = 'authenticated');
    END IF;
END
$$;

-- RLS Policies for invoices
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view invoices for their families' AND tablename = 'invoices') THEN
        CREATE POLICY "Users can view invoices for their families" ON invoices
            FOR SELECT USING (
                family_id IN (
                    SELECT family_id FROM profiles WHERE id = auth.uid()
                ) OR auth.role() = 'service_role'
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can insert invoices' AND tablename = 'invoices') THEN
        CREATE POLICY "Authenticated users can insert invoices" ON invoices
            FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can update invoices' AND tablename = 'invoices') THEN
        CREATE POLICY "Authenticated users can update invoices" ON invoices
            FOR UPDATE USING (auth.role() = 'authenticated');
    END IF;
END
$$;

-- RLS Policies for invoice_line_items
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view line items for accessible invoices' AND tablename = 'invoice_line_items') THEN
        CREATE POLICY "Users can view line items for accessible invoices" ON invoice_line_items
            FOR SELECT USING (
                invoice_id IN (
                    SELECT id FROM invoices WHERE 
                        family_id IN (
                            SELECT family_id FROM profiles WHERE id = auth.uid()
                        ) OR auth.role() = 'service_role'
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can manage line items' AND tablename = 'invoice_line_items') THEN
        CREATE POLICY "Authenticated users can manage line items" ON invoice_line_items
            FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END
$$;

-- RLS Policies for invoice_payments
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view payments for accessible invoices' AND tablename = 'invoice_payments') THEN
        CREATE POLICY "Users can view payments for accessible invoices" ON invoice_payments
            FOR SELECT USING (
                invoice_id IN (
                    SELECT id FROM invoices WHERE 
                        family_id IN (
                            SELECT family_id FROM profiles WHERE id = auth.uid()
                        ) OR auth.role() = 'service_role'
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can manage payments' AND tablename = 'invoice_payments') THEN
        CREATE POLICY "Authenticated users can manage payments" ON invoice_payments
            FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END
$$;

-- RLS Policies for invoice_status_history
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view status history for accessible invoices' AND tablename = 'invoice_status_history') THEN
        CREATE POLICY "Users can view status history for accessible invoices" ON invoice_status_history
            FOR SELECT USING (
                invoice_id IN (
                    SELECT id FROM invoices WHERE 
                        family_id IN (
                            SELECT family_id FROM profiles WHERE id = auth.uid()
                        ) OR auth.role() = 'service_role'
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can manage status history' AND tablename = 'invoice_status_history') THEN
        CREATE POLICY "Authenticated users can manage status history" ON invoice_status_history
            FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END
$$;

-- Create default invoice entity for the school
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM invoice_entities WHERE name = 'Karate School' AND entity_type = 'school') THEN
        INSERT INTO invoice_entities (
            name,
            entity_type,
            contact_person,
            email,
            phone,
            address_line1,
            city,
            state,
            postal_code,
            country,
            payment_terms,
            is_active,
            notes
        ) VALUES (
            'Karate School',
            'school',
            'School Administrator',
            'admin@karateschool.com',
            '(555) 123-4567',
            '123 Martial Arts Way',
            'Anytown',
            'CA',
            '12345',
            'US',
            'Net 30',
            true,
            'Default school entity for invoice generation'
        );
    END IF;
END
$$;

-- --- Invoice Templates System ---

-- Create invoice_templates table
CREATE TABLE IF NOT EXISTS invoice_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    description TEXT,
    category VARCHAR NOT NULL CHECK (category IN ('enrollment', 'fees', 'products', 'custom')),
    is_active BOOLEAN DEFAULT true,
    is_system_template BOOLEAN DEFAULT false, -- For built-in vs custom templates
    created_by UUID REFERENCES profiles(id),
    default_terms TEXT,
    default_notes TEXT,
    default_footer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoice_template_line_items table
CREATE TABLE IF NOT EXISTS invoice_template_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES invoice_templates(id) ON DELETE CASCADE,
    item_type invoice_item_type NOT NULL,
    description TEXT NOT NULL,
    quantity_cents INTEGER DEFAULT 100, -- Migrated from DECIMAL(10,2) to INT4 cents storage (1.00 = 100 cents)
    unit_price_cents INTEGER DEFAULT 0, -- Migrated from DECIMAL(10,2) to INT4 cents storage
    tax_rate DECIMAL(6,4) DEFAULT 0, -- Keep as DECIMAL for percentage rates
    discount_rate DECIMAL(6,4) DEFAULT 0, -- Keep as DECIMAL for percentage rates
    service_period_start DATE,
    service_period_end DATE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoice_templates_category') THEN
        CREATE INDEX idx_invoice_templates_category ON invoice_templates(category);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoice_templates_is_active') THEN
        CREATE INDEX idx_invoice_templates_is_active ON invoice_templates(is_active);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoice_templates_is_system') THEN
        CREATE INDEX idx_invoice_templates_is_system ON invoice_templates(is_system_template);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoice_template_line_items_template_id') THEN
        CREATE INDEX idx_invoice_template_line_items_template_id ON invoice_template_line_items(template_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_invoice_template_line_items_sort_order') THEN
        CREATE INDEX idx_invoice_template_line_items_sort_order ON invoice_template_line_items(sort_order);
    END IF;
END
$$;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_invoice_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_invoice_template_updated_at') THEN
        CREATE TRIGGER trigger_update_invoice_template_updated_at
            BEFORE UPDATE ON invoice_templates
            FOR EACH ROW
            EXECUTE FUNCTION update_invoice_template_updated_at();
    END IF;
END
$$;

-- Enable RLS for invoice templates
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_template_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoice_templates
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view all invoice templates' AND tablename = 'invoice_templates') THEN
        CREATE POLICY "Users can view all invoice templates" ON invoice_templates
            FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can manage invoice templates' AND tablename = 'invoice_templates') THEN
        CREATE POLICY "Authenticated users can manage invoice templates" ON invoice_templates
            FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END
$$;

-- RLS Policies for invoice_template_line_items
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view all template line items' AND tablename = 'invoice_template_line_items') THEN
        CREATE POLICY "Users can view all template line items" ON invoice_template_line_items
            FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can manage template line items' AND tablename = 'invoice_template_line_items') THEN
        CREATE POLICY "Authenticated users can manage template line items" ON invoice_template_line_items
            FOR ALL USING (auth.role() = 'authenticated');
    END IF;
END
$$;

-- Insert system templates (migrated from static data)
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM invoice_templates WHERE id = '550e8400-e29b-41d4-a716-446655440001') THEN
        INSERT INTO invoice_templates (id, name, description, category, is_system_template, default_terms, default_notes) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', 'Monthly Class Enrollment', 'Standard monthly enrollment fee for regular classes', 'enrollment', true, 'Payment is due by the 1st of each month. Late fees may apply after the 5th.', 'Thank you for your continued participation in our martial arts program.'),
        ('550e8400-e29b-41d4-a716-446655440002', 'New Student Registration', 'Complete package for new student registration including fees and equipment', 'enrollment', true, 'Registration fee is non-refundable. Monthly fees are due by the 1st of each month.', 'Welcome to our martial arts family! We look forward to your training journey.'),
        ('550e8400-e29b-41d4-a716-446655440003', 'Belt Testing Fees', 'Fees for belt promotion testing', 'fees', true, 'Testing fees are due before the testing date.', 'Congratulations on your progress! Good luck with your testing.'),
        ('550e8400-e29b-41d4-a716-446655440004', 'Tournament Registration', 'Registration fees for tournament participation', 'fees', true, 'Tournament fees are non-refundable and must be paid before the registration deadline.', 'We wish you the best of luck in the tournament!'),
        ('550e8400-e29b-41d4-a716-446655440005', 'Sparring Equipment Package', 'Complete sparring gear package for competition students', 'products', true, 'Equipment sales are final. Please ensure proper fit before purchase.', 'This equipment meets tournament standards and regulations.'),
        ('550e8400-e29b-41d4-a716-446655440006', 'Private Lesson Package', 'Package of private one-on-one lessons', 'enrollment', true, 'Private lessons must be scheduled in advance and are subject to instructor availability.', 'Private lessons provide personalized instruction to accelerate your progress.'),
        ('550e8400-e29b-41d4-a716-446655440007', 'Family Enrollment with Discount', 'Multiple family members with family discount applied', 'enrollment', true, 'Family discount applies to additional family members. Payment is due by the 1st of each month.', 'Thank you for bringing your family to train with us!'),
        ('550e8400-e29b-41d4-a716-446655440008', 'Makeup Class Fees', 'Fees for makeup classes due to absences', 'fees', true, 'Makeup classes must be scheduled within 30 days of the missed class.', 'Makeup classes help ensure you stay on track with your training.'),
        ('550e8400-e29b-41d4-a716-446655440009', 'Summer Camp Program', 'Week-long summer martial arts camp', 'enrollment', true, 'Camp fees are due one week before the camp start date. Cancellations must be made 48 hours in advance.', 'Our summer camp provides intensive training and fun activities for all skill levels.'),
        ('550e8400-e29b-41d4-a716-446655440010', 'Annual Membership Discount', 'Full year membership with discount for upfront payment', 'enrollment', true, 'Annual membership is non-refundable but transferable. Membership includes all regular classes.', 'Thank you for your commitment to training with us for the full year!');
    END IF;
END
$$;

-- Insert template line items
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM invoice_template_line_items WHERE template_id = '550e8400-e29b-41d4-a716-446655440001') THEN
        INSERT INTO invoice_template_line_items (template_id, item_type, description, quantity_cents, unit_price_cents, tax_rate, discount_rate, sort_order) VALUES
        -- Monthly enrollment
        ('550e8400-e29b-41d4-a716-446655440001', 'class_enrollment', 'Monthly Class Fee', 100, 0, 0, 0, 0),

        -- Registration package
        ('550e8400-e29b-41d4-a716-446655440002', 'fee', 'Registration Fee', 100, 5000, 0, 0, 0),
        ('550e8400-e29b-41d4-a716-446655440002', 'fee', 'Uniform (Gi)', 100, 7500, 0, 0, 1),
        ('550e8400-e29b-41d4-a716-446655440002', 'fee', 'Belt', 100, 1500, 0, 0, 2),
        ('550e8400-e29b-41d4-a716-446655440002', 'class_enrollment', 'First Month Class Fee', 100, 0, 0, 0, 3),

        -- Testing fees
        ('550e8400-e29b-41d4-a716-446655440003', 'fee', 'Belt Testing Fee', 100, 4000, 0, 0, 0),
        ('550e8400-e29b-41d4-a716-446655440003', 'fee', 'New Belt', 100, 2000, 0, 0, 1),

        -- Tournament fees
        ('550e8400-e29b-41d4-a716-446655440004', 'fee', 'Tournament Entry Fee', 100, 6000, 0, 0, 0),
        ('550e8400-e29b-41d4-a716-446655440004', 'fee', 'USANKF Membership (if required)', 100, 3500, 0, 0, 1),

        -- Equipment package
        ('550e8400-e29b-41d4-a716-446655440005', 'fee', 'Sparring Gloves', 100, 4500, 0, 0, 0),
        ('550e8400-e29b-41d4-a716-446655440005', 'fee', 'Foot Pads', 100, 3500, 0, 0, 1),
        ('550e8400-e29b-41d4-a716-446655440005', 'fee', 'Shin Guards', 100, 4000, 0, 0, 2),
        ('550e8400-e29b-41d4-a716-446655440005', 'fee', 'Headgear', 100, 6500, 0, 0, 3),
        ('550e8400-e29b-41d4-a716-446655440005', 'fee', 'Mouthguard', 100, 1500, 0, 0, 4),

        -- Private lessons
        ('550e8400-e29b-41d4-a716-446655440006', 'individual_session', 'Private Lesson (1 hour)', 400, 7500, 0, 0, 0),

        -- Family discount
        ('550e8400-e29b-41d4-a716-446655440007', 'class_enrollment', 'First Family Member - Monthly Fee', 100, 0, 0, 0, 0),
        ('550e8400-e29b-41d4-a716-446655440007', 'class_enrollment', 'Additional Family Member - Monthly Fee', 100, 0, 0, 0.10, 1),

        -- Makeup classes
        ('550e8400-e29b-41d4-a716-446655440008', 'fee', 'Makeup Class Fee', 100, 2500, 0, 0, 0),

        -- Summer camp
        ('550e8400-e29b-41d4-a716-446655440009', 'fee', 'Summer Camp Week 1', 100, 15000, 0, 0, 0),
        ('550e8400-e29b-41d4-a716-446655440009', 'fee', 'Camp T-Shirt', 100, 2000, 0, 0, 1),
        ('550e8400-e29b-41d4-a716-446655440009', 'fee', 'Lunch (5 days)', 100, 5000, 0, 0, 2),

        -- Annual membership
        ('550e8400-e29b-41d4-a716-446655440010', 'class_enrollment', 'Annual Membership (12 months)', 1200, 0, 0, 0.15, 0);
    END IF;
END
$$;

-- --- End Invoice Templates System ---

-- --- End Invoice System ---

-- --- Events System ---

-- Note: event_type_enum removed - using foreign key to event_types table instead

-- Create event_types table for dynamic event type management
CREATE TABLE IF NOT EXISTS event_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text UNIQUE NOT NULL, -- Unique identifier for event type
    display_name text NOT NULL,
    description text,
    color_class text NOT NULL DEFAULT 'bg-gray-100 text-gray-800',
    border_class text,
    dark_mode_class text,
    icon text,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create updated_at trigger for event_types
CREATE OR REPLACE TRIGGER event_types_updated_at
    BEFORE UPDATE ON event_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default event types with styling
INSERT INTO event_types (name, display_name, description, color_class, border_class, dark_mode_class, sort_order)
VALUES 
    ('competition', 'Competition', 'Competitive karate events and matches', 'bg-red-100 text-red-800', 'border-red-200', 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', 1),
    ('tournament', 'Tournament', 'Large-scale competitive tournaments', 'bg-orange-100 text-orange-800', 'border-orange-200', 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', 2),
    ('testing', 'Testing', 'Belt testing and rank advancement', 'bg-yellow-100 text-yellow-800', 'border-yellow-200', 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', 3),
    ('seminar', 'Seminar', 'Educational seminars and workshops', 'bg-blue-100 text-blue-800', 'border-blue-200', 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', 4),
    ('workshop', 'Workshop', 'Skill-building workshops and training', 'bg-green-100 text-green-800', 'border-green-200', 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', 5),
    ('social_event', 'Social Event', 'Community gatherings and social activities', 'bg-pink-100 text-pink-800', 'border-pink-200', 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200', 6),
    ('fundraiser', 'Fundraiser', 'Fundraising events and activities', 'bg-purple-100 text-purple-800', 'border-purple-200', 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', 7),
    ('other', 'Other', 'Other types of events', 'bg-gray-100 text-gray-800', 'border-gray-200', 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200', 8)
ON CONFLICT (name) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'prevent_other_deletion'
          AND conrelid = 'public.event_types'::regclass
    ) THEN
        ALTER TABLE public.event_types
            ADD CONSTRAINT prevent_other_deletion
            CHECK (name != 'other' OR is_active = true);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_event_type_id(p_name text)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT id FROM public.event_types WHERE name = p_name LIMIT 1;
$$;

-- Create event_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status_enum') THEN
        CREATE TYPE event_status_enum AS ENUM (
            'draft',
            'published',
            'registration_open',
            'registration_closed',
            'in_progress',
            'completed',
            'cancelled'
        );
    END IF;
END $$;

-- Create registration_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'registration_status_enum') THEN
        CREATE TYPE registration_status_enum AS ENUM (
            'pending',
            'confirmed',
            'cancelled',
            'waitlist'
        );
    END IF;
END $$;

-- Create event_visibility enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_visibility_enum') THEN
        CREATE TYPE event_visibility_enum AS ENUM (
            'public',
            'limited',
            'internal'
        );
    END IF;
END $$;

-- Create events table
CREATE TABLE IF NOT EXISTS events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    event_type_id uuid REFERENCES event_types(id) NOT NULL DEFAULT public.get_event_type_id('other'),
    status event_status_enum NOT NULL DEFAULT 'draft',
    
    -- Date and time information
    start_date date NOT NULL,
    end_date date,
    start_time time,
    end_time time,
    timezone text DEFAULT 'America/Toronto',
    
    -- Location information
    location text,
    address text,
    location_name text,
    street_address text,
    locality text,
    region text,
    postal_code text,
    country text,
    
    -- Registration and capacity
    max_participants integer,
    registration_deadline date,
    min_age integer,
    max_age integer,
    min_belt_rank belt_rank_enum,
    max_belt_rank belt_rank_enum,
    
    -- Pricing
    registration_fee_cents INTEGER DEFAULT 0, -- Migrated from DECIMAL(10,2) to INT4 cents storage
    late_registration_fee_cents INTEGER, -- Migrated from DECIMAL(10,2) to INT4 cents storage
    
    -- Requirements
    requires_waiver boolean DEFAULT false,
    required_waiver_ids uuid[] DEFAULT '{}',
    requires_equipment text[], -- Array of required equipment
    
    -- Administrative
    instructor_id uuid REFERENCES profiles(id),
    created_by uuid REFERENCES profiles(id) NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    -- Additional metadata
    external_url text, -- For external registration or info
    notes text,
    visibility event_visibility_enum NOT NULL DEFAULT 'public' -- Event visibility level
);

-- Create event registrations table
CREATE TABLE IF NOT EXISTS event_registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    student_id uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    family_id uuid REFERENCES families(id) ON DELETE CASCADE NOT NULL,
    
    -- Registration details
    registered_at timestamptz DEFAULT now(),
    registration_status registration_status_enum DEFAULT 'pending',
    
    -- Payment tracking
    payment_required boolean DEFAULT true,
    payment_amount_cents INTEGER, -- Migrated from DECIMAL(10,2) to INT4 cents storage
    payment_status payment_status DEFAULT 'pending',
    payment_id uuid REFERENCES payments(id),
    
    -- Additional info
    notes text,
    emergency_contact text,
    
    UNIQUE(event_id, student_id)
);

-- Create event waivers junction table (for events requiring specific waivers)
CREATE TABLE IF NOT EXISTS event_waivers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    waiver_id uuid REFERENCES waivers(id) ON DELETE CASCADE NOT NULL,
    is_required boolean DEFAULT true,

    UNIQUE(event_id, waiver_id)
);

-- Program waivers junction table (for program-specific waiver requirements)
CREATE TABLE IF NOT EXISTS program_waivers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id uuid REFERENCES programs(id) ON DELETE CASCADE NOT NULL,
    waiver_id uuid REFERENCES waivers(id) ON DELETE CASCADE NOT NULL,
    is_required boolean DEFAULT true,
    required_for_trial boolean DEFAULT false,
    required_for_full_enrollment boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE(program_id, waiver_id)
);

-- Create indexes for performance
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_events_start_date') THEN
        CREATE INDEX idx_events_start_date ON events(start_date);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_events_status') THEN
        CREATE INDEX idx_events_status ON events(status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_events_type') THEN
        CREATE INDEX idx_events_type ON events(event_type_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_events_instructor') THEN
        CREATE INDEX idx_events_instructor ON events(instructor_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_events_created_by') THEN
        CREATE INDEX idx_events_created_by ON events(created_by);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_event_registrations_event') THEN
        CREATE INDEX idx_event_registrations_event ON event_registrations(event_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_event_registrations_student') THEN
        CREATE INDEX idx_event_registrations_student ON event_registrations(student_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_event_registrations_family') THEN
        CREATE INDEX idx_event_registrations_family ON event_registrations(family_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_event_registrations_status') THEN
        CREATE INDEX idx_event_registrations_status ON event_registrations(registration_status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_event_waivers_event') THEN
        CREATE INDEX idx_event_waivers_event ON event_waivers(event_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_event_waivers_waiver') THEN
        CREATE INDEX idx_event_waivers_waiver ON event_waivers(waiver_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_program_waivers_program') THEN
        CREATE INDEX idx_program_waivers_program ON program_waivers(program_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_program_waivers_waiver') THEN
        CREATE INDEX idx_program_waivers_waiver ON program_waivers(waiver_id);
    END IF;
END
$$;

-- Add RLS policies
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_waivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_waivers ENABLE ROW LEVEL SECURITY;

-- Events policies
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public and limited events are viewable by everyone' AND tablename = 'events') THEN
        CREATE POLICY "Public and limited events are viewable by everyone" ON events
            FOR SELECT USING (visibility IN ('public', 'limited'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can view all events' AND tablename = 'events') THEN
        CREATE POLICY "Authenticated users can view all events" ON events
            FOR SELECT USING (auth.uid() IS NOT NULL);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage all events' AND tablename = 'events') THEN
        CREATE POLICY "Admin can manage all events" ON events
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.role = 'admin'::profile_role
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Instructors can view and manage their events' AND tablename = 'events') THEN
        CREATE POLICY "Instructors can view and manage their events" ON events
            FOR ALL USING (
                instructor_id = auth.uid() OR
                created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.role IN ('admin'::profile_role, 'instructor'::profile_role)
                )
            );
    END IF;
END
$$;

-- Event registrations policies
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their family registrations' AND tablename = 'event_registrations') THEN
        CREATE POLICY "Users can view their family registrations" ON event_registrations
            FOR SELECT USING (
                family_id IN (
                    SELECT family_id FROM profiles WHERE id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can register their family members' AND tablename = 'event_registrations') THEN
        CREATE POLICY "Users can register their family members" ON event_registrations
            FOR INSERT WITH CHECK (
                family_id IN (
                    SELECT family_id FROM profiles WHERE id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage all event registrations' AND tablename = 'event_registrations') THEN
        CREATE POLICY "Admin can manage all event registrations" ON event_registrations
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.role = 'admin'::profile_role
                )
            );
    END IF;
END
$$;

-- Event waivers policies
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Event waivers are viewable by all authenticated users' AND tablename = 'event_waivers') THEN
        CREATE POLICY "Event waivers are viewable by all authenticated users" ON event_waivers
            FOR SELECT TO authenticated USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can manage event waivers' AND tablename = 'event_waivers') THEN
        CREATE POLICY "Admin can manage event waivers" ON event_waivers
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.role = 'admin'::profile_role
                )
            );
    END IF;
END
$$;

-- Function to update updated_at timestamp for events
CREATE OR REPLACE FUNCTION update_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for events table
DO
$$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_events_updated_at') THEN
        CREATE TRIGGER update_events_updated_at
            BEFORE UPDATE ON events
            FOR EACH ROW
            EXECUTE FUNCTION update_events_updated_at();
    END IF;
END
$$;

-- Enum for eligibility check reasons
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'eligibility_reason_enum') THEN
        CREATE TYPE eligibility_reason_enum AS ENUM (
            'eligible',
            'event_not_found',
            'student_not_found',
            'registration_not_open',
            'registration_deadline_passed',
            'already_registered',
            'event_full',
            'student_too_young',
            'student_too_old',
            'student_belt_rank_too_low',
            'student_belt_rank_too_high'
        );
    END IF;
END $$;

-- Helper function to get belt rank order for comparison
CREATE OR REPLACE FUNCTION get_belt_rank_order(belt_rank belt_rank_enum)
RETURNS INTEGER AS $$
BEGIN
    CASE belt_rank
        WHEN 'white' THEN RETURN 0;
        WHEN 'yellow' THEN RETURN 1;
        WHEN 'orange' THEN RETURN 2;
        WHEN 'green' THEN RETURN 3;
        WHEN 'blue' THEN RETURN 4;
        WHEN 'purple' THEN RETURN 5;
        WHEN 'red' THEN RETURN 6;
        WHEN 'brown' THEN RETURN 7;
        WHEN 'black' THEN RETURN 8;
        ELSE RETURN 0; -- Default to white belt if unknown
    END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check event registration eligibility
-- Returns all eligibility issues instead of stopping at the first one
CREATE OR REPLACE FUNCTION check_event_registration_eligibility(
    p_event_id uuid,
    p_student_id uuid
) RETURNS jsonb AS $$
DECLARE
    event_record events%ROWTYPE;
    student_record students%ROWTYPE;
    student_belt_rank belt_rank_enum;
    student_belt_order integer;
    min_belt_order integer;
    max_belt_order integer;
    student_age integer;
    current_registrations integer;
    issues eligibility_reason_enum[] := '{}';
    primary_reason eligibility_reason_enum;
    reason_priority integer;
    max_priority integer := 0;
    result jsonb;
BEGIN
    -- Get event details
    SELECT * INTO event_record FROM events WHERE id = p_event_id;
    IF NOT FOUND THEN
        issues := array_append(issues, 'event_not_found');
    END IF;
    
    -- Get student details
    SELECT * INTO student_record FROM students WHERE id = p_student_id;
    IF NOT FOUND THEN
        issues := array_append(issues, 'student_not_found');
    END IF;
    
    -- If event or student not found, return early as other checks are meaningless
    IF 'event_not_found' = ANY(issues) OR 'student_not_found' = ANY(issues) THEN
        primary_reason := CASE 
            WHEN 'event_not_found' = ANY(issues) THEN 'event_not_found'
            ELSE 'student_not_found'
        END;
        RETURN jsonb_build_object(
            'eligible', false, 
            'reason', primary_reason,
            'all_issues', issues
        );
    END IF;
    
    -- Check if already registered (highest priority issue)
    IF EXISTS (SELECT 1 FROM event_registrations WHERE event_id = p_event_id AND student_id = p_student_id) THEN
        issues := array_append(issues, 'already_registered');
    END IF;
    
    -- Check if event is accepting registrations
    IF event_record.status NOT IN ('published', 'registration_open') THEN
        issues := array_append(issues, 'registration_not_open');
    END IF;
    
    -- Check registration deadline
    IF event_record.registration_deadline IS NOT NULL AND event_record.registration_deadline < CURRENT_DATE THEN
        issues := array_append(issues, 'registration_deadline_passed');
    END IF;
    
    -- Check capacity
    IF event_record.max_participants IS NOT NULL THEN
        SELECT COUNT(*) INTO current_registrations 
        FROM event_registrations 
        WHERE event_id = p_event_id AND registration_status = 'confirmed';
        
        IF current_registrations >= event_record.max_participants THEN
            issues := array_append(issues, 'event_full');
        END IF;
    END IF;
    
    -- Check age requirements
    student_age := EXTRACT(YEAR FROM AGE(student_record.birth_date));
    IF event_record.min_age IS NOT NULL AND student_age < event_record.min_age THEN
        issues := array_append(issues, 'student_too_young');
    END IF;
    
    IF event_record.max_age IS NOT NULL AND student_age > event_record.max_age THEN
        issues := array_append(issues, 'student_too_old');
    END IF;
    
    -- Check belt rank requirements
    SELECT type INTO student_belt_rank 
    FROM belt_awards 
    WHERE student_id = p_student_id 
    ORDER BY awarded_date DESC 
    LIMIT 1;
    
    -- If no belt rank found, assume white belt
    IF student_belt_rank IS NULL THEN
        student_belt_rank := 'white';
    END IF;
    
    -- Get belt rank orders for comparison
    student_belt_order := get_belt_rank_order(student_belt_rank);
    
    -- Check minimum belt rank requirement
    IF event_record.min_belt_rank IS NOT NULL THEN
        min_belt_order := get_belt_rank_order(event_record.min_belt_rank);
        IF student_belt_order < min_belt_order THEN
            issues := array_append(issues, 'student_belt_rank_too_low');
        END IF;
    END IF;
    
    -- Check maximum belt rank requirement
    IF event_record.max_belt_rank IS NOT NULL THEN
        max_belt_order := get_belt_rank_order(event_record.max_belt_rank);
        IF student_belt_order > max_belt_order THEN
            issues := array_append(issues, 'student_belt_rank_too_high');
        END IF;
    END IF;
    
    -- If no issues found, student is eligible
    IF array_length(issues, 1) IS NULL THEN
        RETURN jsonb_build_object(
            'eligible', true, 
            'reason', 'eligible',
            'all_issues', '{}'::eligibility_reason_enum[]
        );
    END IF;
    
    -- Determine primary reason based on priority
    -- Priority order: already_registered > registration issues > capacity > requirements
    FOREACH primary_reason IN ARRAY issues LOOP
        reason_priority := CASE primary_reason
            WHEN 'already_registered' THEN 10
            WHEN 'registration_not_open' THEN 9
            WHEN 'registration_deadline_passed' THEN 8
            WHEN 'event_full' THEN 7
            WHEN 'student_too_young' THEN 6
            WHEN 'student_too_old' THEN 5
            WHEN 'student_belt_rank_too_low' THEN 4
            WHEN 'student_belt_rank_too_high' THEN 3
            ELSE 1
        END;
        
        IF reason_priority > max_priority THEN
            max_priority := reason_priority;
        END IF;
    END LOOP;
    
    -- Find the primary reason with highest priority
    FOREACH primary_reason IN ARRAY issues LOOP
        reason_priority := CASE primary_reason
            WHEN 'already_registered' THEN 10
            WHEN 'registration_not_open' THEN 9
            WHEN 'registration_deadline_passed' THEN 8
            WHEN 'event_full' THEN 7
            WHEN 'student_too_young' THEN 6
            WHEN 'student_too_old' THEN 5
            WHEN 'student_belt_rank_too_low' THEN 4
            WHEN 'student_belt_rank_too_high' THEN 3
            ELSE 1
        END;
        
        IF reason_priority = max_priority THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'eligible', false, 
        'reason', primary_reason,
        'all_issues', issues
    );
END;
$$ LANGUAGE plpgsql;

-- --- End Events System ---

-- Migration 008: Add event_registration to payment_type_enum
-- Add event_registration to payment_type_enum
ALTER TYPE public.payment_type_enum ADD VALUE IF NOT EXISTS 'event_registration';

-- Migration 009: Add entity type enums
-- Migration to add entity type enums to replace hardcoded strings
-- This converts string fields to proper database enums for better type safety

-- Create attendance_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status_enum') THEN
        CREATE TYPE attendance_status_enum AS ENUM (
            'present',
            'absent',
            'excused',
            'late'
        );
    END IF;
END $$;

-- Create class_session_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'class_session_status_enum') THEN
        CREATE TYPE class_session_status_enum AS ENUM (
            'scheduled',
            'in_progress',
            'completed',
            'cancelled'
        );
    END IF;
END $$;

-- Create discount_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_type_enum') THEN
        CREATE TYPE discount_type_enum AS ENUM (
            'fixed_amount',
            'percentage'
        );
    END IF;
END $$;

-- Create discount_scope enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_scope_enum') THEN
        CREATE TYPE discount_scope_enum AS ENUM (
            'per_student',
            'per_family'
        );
    END IF;
END $$;

-- Create discount_usage_type enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'discount_usage_type_enum') THEN
        CREATE TYPE discount_usage_type_enum AS ENUM (
            'one_time',
            'ongoing'
        );
    END IF;
END $$;

-- Update attendance table to use attendance_status_enum
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.attendance'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE public.attendance DROP CONSTRAINT %I', rec.conname);
    END LOOP;
END $$;

ALTER TABLE public.attendance
    ALTER COLUMN status DROP DEFAULT;

ALTER TABLE attendance 
ALTER COLUMN status TYPE attendance_status_enum 
USING status::attendance_status_enum;

ALTER TABLE public.attendance
    ALTER COLUMN status SET DEFAULT 'present'::attendance_status_enum;

-- Update class_sessions table to use class_session_status_enum
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.class_sessions'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE public.class_sessions DROP CONSTRAINT %I', rec.conname);
    END LOOP;
END $$;

ALTER TABLE public.class_sessions
    ALTER COLUMN status DROP DEFAULT;

ALTER TABLE class_sessions 
ALTER COLUMN status TYPE class_session_status_enum 
USING status::class_session_status_enum;

ALTER TABLE public.class_sessions
    ALTER COLUMN status SET DEFAULT 'scheduled'::class_session_status_enum;

-- Update discount_codes table to use the new enums
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.discount_codes'::regclass
          AND contype = 'c'
          AND (
              pg_get_constraintdef(oid) ILIKE '%discount_type%'
           OR pg_get_constraintdef(oid) ILIKE '%usage_type%'
           OR pg_get_constraintdef(oid) ILIKE '%scope%'
        )
    LOOP
        EXECUTE format('ALTER TABLE public.discount_codes DROP CONSTRAINT %I', rec.conname);
    END LOOP;
END $$;

ALTER TABLE discount_codes 
ALTER COLUMN discount_type TYPE discount_type_enum 
USING discount_type::discount_type_enum;

ALTER TABLE discount_codes 
ALTER COLUMN scope TYPE discount_scope_enum 
USING scope::discount_scope_enum;

ALTER TABLE discount_codes 
ALTER COLUMN usage_type TYPE discount_usage_type_enum 
USING usage_type::discount_usage_type_enum;

-- Update discount_templates table to use the new enums
DO $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.discount_templates'::regclass
          AND contype = 'c'
          AND (
              pg_get_constraintdef(oid) ILIKE '%discount_type%'
           OR pg_get_constraintdef(oid) ILIKE '%usage_type%'
           OR pg_get_constraintdef(oid) ILIKE '%scope%'
        )
    LOOP
        EXECUTE format('ALTER TABLE public.discount_templates DROP CONSTRAINT %I', rec.conname);
    END LOOP;
END $$;

ALTER TABLE discount_templates 
ALTER COLUMN discount_type TYPE discount_type_enum 
USING discount_type::discount_type_enum;

ALTER TABLE discount_templates 
ALTER COLUMN scope TYPE discount_scope_enum 
USING scope::discount_scope_enum;

ALTER TABLE discount_templates 
ALTER COLUMN usage_type TYPE discount_usage_type_enum 
USING usage_type::discount_usage_type_enum;

-- Migration 013: Remove payment_status from event_registrations
-- Remove redundant payment_status field from event_registrations table
-- Payment status should only be tracked in the payments table

ALTER TABLE event_registrations DROP COLUMN IF EXISTS payment_status;

-- Migration 025: Create webhook_events table
-- Audit trail for all incoming payment provider webhooks
-- Provides idempotency and debugging capabilities

-- Create webhook_events table for audit trail and idempotency
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Provider and event identification
    provider TEXT NOT NULL CHECK (provider IN ('stripe', 'square', 'mock')),
    event_id TEXT NOT NULL, -- Provider's event ID
    event_type TEXT NOT NULL, -- e.g., 'payment.succeeded', 'payment.failed'
    raw_type TEXT, -- Provider-specific event type (e.g., 'payment.updated' for Square)

    -- Request metadata
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_id TEXT, -- x-vercel-id, x-request-id, etc.
    source_ip TEXT,
    signature_verified BOOLEAN DEFAULT TRUE,

    -- Event payload
    raw_payload JSONB NOT NULL,
    parsed_metadata JSONB, -- Extracted metadata from the event

    -- Processing status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'duplicate')),
    processed_at TIMESTAMPTZ,
    processing_duration_ms INTEGER,

    -- Error tracking
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,

    -- Related records
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure we don't process the same event twice
    UNIQUE (provider, event_id)
);

-- Indexes for performance
CREATE INDEX idx_webhook_events_provider_event_id ON webhook_events(provider, event_id);
CREATE INDEX idx_webhook_events_payment_id ON webhook_events(payment_id) WHERE payment_id IS NOT NULL;
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_received_at ON webhook_events(received_at DESC);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);

-- Enable Row Level Security
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy
CREATE POLICY "Admins can view all webhook events"
    ON webhook_events
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- System can insert/update webhook events
CREATE POLICY "Service role can manage webhook events"
    ON webhook_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_webhook_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_webhook_events_updated_at
    BEFORE UPDATE ON webhook_events
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_events_updated_at();

-- Add comment for documentation
COMMENT ON TABLE webhook_events IS 'Audit trail for all incoming payment provider webhooks. Provides idempotency and debugging capabilities.';
COMMENT ON COLUMN webhook_events.event_id IS 'Unique event identifier from the payment provider';
COMMENT ON COLUMN webhook_events.raw_payload IS 'Full webhook payload as received from provider';
COMMENT ON COLUMN webhook_events.parsed_metadata IS 'Extracted metadata (paymentId, familyId, type, etc.)';
COMMENT ON COLUMN webhook_events.processing_duration_ms IS 'Time taken to process the webhook in milliseconds';

-- ========================================
-- DISCOUNT CODE RESTORATION ON PAYMENT FAILURE
-- ========================================
-- When a payment fails, we need to restore the discount code usage
-- so the user can try again with the same discount.

CREATE OR REPLACE FUNCTION public.restore_discount_on_payment_failure()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only proceed if payment transitioned to 'failed' and had a discount applied
    IF NEW.status = 'failed' AND OLD.status = 'pending' AND NEW.discount_code_id IS NOT NULL THEN

        -- Log the restoration for debugging
        RAISE NOTICE 'Restoring discount code % for failed payment %', NEW.discount_code_id, NEW.id;

        -- Decrement the usage count on the discount code
        UPDATE public.discount_codes
        SET current_uses = GREATEST(0, current_uses - 1),  -- Prevent negative usage
            updated_at = now()
        WHERE id = NEW.discount_code_id;

        -- Delete the usage record (CASCADE will handle this automatically)
        -- This allows the family/student to use the discount again
        DELETE FROM public.discount_code_usage
        WHERE payment_id = NEW.id;

        RAISE NOTICE 'Successfully restored discount code % (deleted usage record for payment %)', NEW.discount_code_id, NEW.id;
    END IF;

    RETURN NEW;
END;
$$;

-- Create trigger on payments table
DROP TRIGGER IF EXISTS trigger_restore_discount_on_payment_failure ON public.payments;
CREATE TRIGGER trigger_restore_discount_on_payment_failure
    AFTER UPDATE ON public.payments
    FOR EACH ROW
    WHEN (NEW.status = 'failed' AND OLD.status = 'pending' AND NEW.discount_code_id IS NOT NULL)
    EXECUTE FUNCTION public.restore_discount_on_payment_failure();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.restore_discount_on_payment_failure() TO service_role;

COMMENT ON FUNCTION public.restore_discount_on_payment_failure IS 'Automatically restores discount code usage when a payment transitions from pending to failed. Allows users to retry payment with the same discount.';
COMMENT ON TRIGGER trigger_restore_discount_on_payment_failure ON public.payments IS 'Fires after a payment status changes to failed, restoring the associated discount code for reuse.';
