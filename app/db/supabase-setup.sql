-- Run this in your Supabase SQL Editor
-- This script is idempotent - safe to run multiple times without duplicating data

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
                       WHERE policyname = 'Allow admins to manage products' AND tablename = 'products') THEN
            CREATE POLICY "Allow admins to manage products" ON public.products
                FOR ALL USING (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
                ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
                ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
                       WHERE policyname = 'Allow family members to view their orders' AND tablename = 'orders') THEN
            CREATE POLICY "Allow family members to view their orders" ON public.orders
                FOR SELECT USING (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.family_id = orders.family_id)
                );
        END IF;
        -- Allow admins to manage all orders
        IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage orders' AND tablename = 'orders') THEN
            CREATE POLICY "Allow admins to manage orders" ON public.orders
                FOR ALL USING (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
                ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
                       WHERE policyname = 'Allow admins to manage order items' AND tablename = 'order_items') THEN
            CREATE POLICY "Allow admins to manage order items" ON public.order_items
                FOR ALL USING (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
                ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
ALTER TABLE payments
    ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text NULL; -- Add Payment Intent ID
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

-- Define the function to update the 'updated_at' column
-- Moved this definition earlier to ensure it exists before triggers use it.
CREATE OR REPLACE FUNCTION update_modified_column()
    RETURNS TRIGGER AS
$$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance
(
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES students (id) ON DELETE CASCADE NOT NULL,
    class_date date                                            NOT NULL,
    present    boolean                                         NOT NULL,
    notes      text,
    CONSTRAINT attendance_class_date_student_id_key UNIQUE (class_date, student_id) -- Add unique constraint
);

DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1
                       FROM pg_indexes
                       WHERE indexname = 'idx_attendance_student_id') THEN
            CREATE INDEX idx_attendance_student_id ON attendance (student_id);
        END IF;
    END
$$;

-- Ensure the unique constraint exists even if the table was created previously without it
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1
                       FROM pg_constraint
                       WHERE conname = 'attendance_class_date_student_id_key'
                         AND conrelid = 'public.attendance'::regclass) THEN
            ALTER TABLE public.attendance
                ADD CONSTRAINT attendance_class_date_student_id_key UNIQUE (class_date, student_id);
        END IF;
    END;
$$;

-- Waivers table
CREATE TABLE IF NOT EXISTS waivers
(
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title       text    NOT NULL,
    description text    NOT NULL,
    content     text    NOT NULL,
    required    boolean NOT NULL DEFAULT false,
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
    END
$$;

-- Policy Agreements table removed in favor of enhanced waiver_signatures

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles
(
    id         uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    email      text NOT NULL,
    role       text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'instructor')),
    family_id  uuid REFERENCES families (id) ON DELETE SET NULL,
    -- Add first_name and last_name columns
    first_name text NULL,
    last_name  text NULL
);

-- Add columns idempotently if they don't exist
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS first_name text NULL;
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS last_name text NULL;

-- Add family_id column idempotently before attempting to index it
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES families (id) ON DELETE SET NULL;

DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1
                       FROM pg_indexes
                       WHERE indexname = 'idx_profiles_family_id') THEN
            CREATE INDEX idx_profiles_family_id ON profiles (family_id);
        END IF;
    END
$$;

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
    END
$$;

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
ALTER TABLE attendance
    ENABLE ROW LEVEL SECURITY;
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
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
                ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
                );
        END IF;
    END
$$;

-- Insert initial tax rates (BC Example) - Make idempotent
INSERT INTO public.tax_rates (name, rate, description, region, is_active)
VALUES ('GST', 0.05, 'Goods and Services Tax', 'CA', true),
       ('PST_BC', 0.07, 'Provincial Sales Tax (British Columbia)', 'BC', true)
ON CONFLICT (name) DO UPDATE SET rate        = EXCLUDED.rate,
                                 description = EXCLUDED.description,
                                 region      = EXCLUDED.region,
                                 is_active   = EXCLUDED.is_active,
                                 updated_at  = now();


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
    END
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
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
                ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
                );
        END IF;
    END
$$;

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
                role = 'admin' -- Can view admin profiles
                    OR
                role = 'instructor' -- Can view instructor profiles (needed for recipient list)
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
                          AND profiles.role = 'admin')
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
                          AND profiles.role = 'admin')
                ) WITH CHECK (
                EXISTS (SELECT 1
                        FROM profiles
                        WHERE profiles.id = auth.uid()
                          AND profiles.role = 'admin')
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

        IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE tablename = 'attendance'
                         AND policyname = 'Attendance is viewable by family members') THEN
            CREATE POLICY "Attendance is viewable by family members" ON attendance
                FOR SELECT USING (
                EXISTS (SELECT 1
                        FROM students
                                 JOIN profiles ON profiles.family_id = students.family_id
                        WHERE attendance.student_id = students.id
                          AND profiles.id = auth.uid())
                );
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
                                 AND profiles.role = 'admin'));
        END IF;
    END
$$;

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

        IF NOT EXISTS (SELECT 1
                       FROM pg_constraint
                       WHERE conname = 'valid_t_shirt_size') THEN
            ALTER TABLE students
                ADD CONSTRAINT valid_t_shirt_size
                    CHECK (t_shirt_size IN ('YXS', 'YS', 'YM', 'YL', 'YXL', 'AS', 'AM', 'AL', 'AXL', 'A2XL'));
        END IF;
    END
$$;

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
    END
$$;

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
    END
$$;
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_one_on_one_sessions_payment_id') THEN
            CREATE INDEX idx_one_on_one_sessions_payment_id ON public.one_on_one_sessions (payment_id);
        END IF;
    END
$$;

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
                          AND p.role = 'admin')
                ) WITH CHECK (
                EXISTS (SELECT 1
                        FROM public.profiles p
                        WHERE p.id = auth.uid()
                          AND p.role = 'admin')
                );
        END IF;
    END
$$;

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
    END
$$;
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_one_on_one_session_usage_student_id') THEN
            CREATE INDEX idx_one_on_one_session_usage_student_id ON public.one_on_one_session_usage (student_id);
        END IF;
    END
$$;
DO
$$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_one_on_one_session_usage_recorded_by') THEN
            CREATE INDEX idx_one_on_one_session_usage_recorded_by ON public.one_on_one_session_usage (recorded_by);
        END IF;
    END
$$;

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
                          AND p.role = 'admin')
                ) WITH CHECK (
                EXISTS (SELECT 1
                        FROM public.profiles p
                        WHERE p.id = auth.uid()
                          AND p.role = 'admin')
                );
        END IF;
    END
$$;


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
    END
$$;

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
    END
$$;

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
    END
$$;

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
    END
$$;


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
                    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
                    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
                    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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

    END
$$;

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
    RETURNING id INTO new_conversation_id;

    -- 2. Add the sender as a participant
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (new_conversation_id, p_sender_id);

    -- 3. Add all admin and instructor users as participants
    FOR admin_instructor_id IN
        SELECT id FROM public.profiles WHERE role IN ('admin', 'instructor')
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

-- Function for Admin/Instructor to initiate a conversation with a specific family
CREATE OR REPLACE FUNCTION public.create_admin_initiated_conversation(
    p_sender_id uuid, -- The admin/instructor initiating
    p_target_family_id uuid, -- The family being messaged
    p_subject text,
    p_message_body text
)
    RETURNS uuid -- Returns the new conversation_id
    LANGUAGE plpgsql
    SECURITY DEFINER -- Executes with elevated privileges to add participants across families
AS
$$
DECLARE
    new_conversation_id uuid;
    family_member_id    uuid;
BEGIN
    -- Set search_path for safety within SECURITY DEFINER
    SET LOCAL search_path = public, extensions;

    -- 1. Create the conversation
    INSERT INTO public.conversations (subject)
    VALUES (p_subject)
    RETURNING id INTO new_conversation_id;

    -- 2. Add the sender (admin/instructor) as a participant
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (new_conversation_id, p_sender_id);

    -- 3. Find all users associated with the target family and add them as participants
    FOR family_member_id IN
        SELECT id FROM public.profiles WHERE family_id = p_target_family_id
        LOOP
        -- Use INSERT ... ON CONFLICT DO NOTHING to avoid errors if a user somehow exists twice or overlaps
        -- Explicitly set last_read_at to -infinity for new family participants
            INSERT INTO public.conversation_participants (conversation_id, user_id, last_read_at)
            VALUES (new_conversation_id, family_member_id, '-infinity'::timestamptz)
            ON CONFLICT (conversation_id, user_id) DO NOTHING;
        END LOOP;

    -- 4. Add the initial message from the sender
    INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES (new_conversation_id, p_sender_id, p_message_body);

    -- 5. Return the new conversation ID
    RETURN new_conversation_id;

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
    result        JSONB;
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
    result     JSONB;
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
    EXECUTE 'SET LOCAL statement_timeout = 3000'; -- 3 seconds

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
                                       AND p.role IN ('admin', 'instructor')
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
                            WHEN pd.role IN ('admin', 'instructor') THEN initcap(pd.role) -- Capitalize role
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
    INSERT INTO public.families (
        name, address, city, province, postal_code, primary_phone, email,
        referral_source, referral_name, emergency_contact, health_info
    ) VALUES (
        p_family_name, p_address, p_city, p_province, p_postal_code, p_primary_phone, p_user_email,
        p_referral_source, p_referral_name, p_emergency_contact, p_health_info
    ) RETURNING id INTO new_family_id;

    -- 2. Update the user's profile with the new family_id and their first/last name
    -- The profile record is created by the on_auth_user_created trigger.
    UPDATE public.profiles
    SET family_id = new_family_id,
        first_name = p_contact1_first_name,
        last_name = p_contact1_last_name
        -- role is already defaulted to 'user' in the table definition and by the trigger's insert.
    WHERE id = p_user_id;

    -- 3. Create the primary guardian record
    INSERT INTO public.guardians (
        family_id, first_name, last_name, relationship, home_phone, work_phone, cell_phone, email
    ) VALUES (
        new_family_id, p_contact1_first_name, p_contact1_last_name, p_contact1_type,
        p_contact1_home_phone, p_contact1_work_phone, p_contact1_cell_phone, p_user_email
    );

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
    discount_value numeric(10,2) NOT NULL CHECK (discount_value > 0),
    
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
            ALTER TABLE public.discount_codes ADD CONSTRAINT discount_codes_association_check CHECK (
                (family_id IS NOT NULL AND student_id IS NULL) OR
                (family_id IS NULL AND student_id IS NOT NULL)
            );
        END IF;
        
        -- Add scope association check constraint if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discount_codes_scope_association_check') THEN
            ALTER TABLE public.discount_codes ADD CONSTRAINT discount_codes_scope_association_check CHECK (
                (scope = 'per_family' AND family_id IS NOT NULL) OR
                (scope = 'per_student' AND student_id IS NOT NULL)
            );
        END IF;
    END
$$;

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
    END
$$;

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
                FOR SELECT TO authenticated USING (is_active = true AND valid_from <= now() AND (valid_until IS NULL OR valid_until >= now()));
        END IF;
        
        -- Allow admins to manage all discount codes
        IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to manage discount codes'
                         AND tablename = 'discount_codes') THEN
            CREATE POLICY "Allow admins to manage discount codes" ON public.discount_codes
                FOR ALL USING (
                    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
                ) WITH CHECK (
                    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
                );
        END IF;
    END
$$;

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
    END
$$;

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
                    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.family_id = family_id)
                );
        END IF;
        
        -- Allow admins to view all discount usage
        IF NOT EXISTS (SELECT 1
                       FROM pg_policies
                       WHERE policyname = 'Allow admins to view all discount usage'
                         AND tablename = 'discount_code_usage') THEN
            CREATE POLICY "Allow admins to view all discount usage" ON public.discount_code_usage
                FOR SELECT TO authenticated USING (
                    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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
    END
$$;

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
    END
$$;

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
    END
$$;

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
    SELECT * INTO v_discount_code
    FROM public.discount_codes
    WHERE code = p_code AND is_active = true;
    
    -- Check if code exists
    IF NOT FOUND THEN
        error_message := 'Invalid discount code';
        RETURN QUERY SELECT is_valid, v_result_discount_code_id, discount_amount, error_message;
        RETURN;
    END IF;
    
    -- Check validity dates
    IF v_discount_code.valid_from > now() THEN
        error_message := 'Discount code is not yet valid';
        RETURN QUERY SELECT is_valid, v_result_discount_code_id, discount_amount, error_message;
        RETURN;
    END IF;
    
    IF v_discount_code.valid_until IS NOT NULL AND v_discount_code.valid_until < now() THEN
        error_message := 'Discount code has expired';
        RETURN QUERY SELECT is_valid, v_result_discount_code_id, discount_amount, error_message;
        RETURN;
    END IF;
    
    -- Check applicability
    IF NOT (p_applicable_to = ANY(v_discount_code.applicable_to)) THEN
        error_message := 'Discount code is not applicable to this type of purchase';
        RETURN QUERY SELECT is_valid, v_result_discount_code_id, discount_amount, error_message;
        RETURN;
    END IF;
    
    -- Check usage limits
    IF v_discount_code.max_uses IS NOT NULL THEN
        SELECT current_uses INTO v_usage_count
        FROM public.discount_codes
        WHERE id = v_discount_code.id;
        
        IF v_usage_count >= v_discount_code.max_uses THEN
            error_message := 'Discount code has reached its usage limit';
            RETURN QUERY SELECT is_valid, v_result_discount_code_id, discount_amount, error_message;
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
                RETURN QUERY SELECT is_valid, v_result_discount_code_id, discount_amount, error_message;
                RETURN;
            END IF;
        ELSIF v_discount_code.scope = 'per_student' AND p_student_id IS NOT NULL THEN
            -- Check if student has used this code before
            IF EXISTS (
                SELECT 1 FROM public.discount_code_usage
                WHERE discount_code_usage.discount_code_id = v_discount_code.id AND student_id = p_student_id
            ) THEN
                error_message := 'This discount code has already been used for this student';
                RETURN QUERY SELECT is_valid, v_result_discount_code_id, discount_amount, error_message;
                RETURN;
            END IF;
        END IF;
    END IF;
    
    -- Calculate discount amount
    IF p_subtotal_amount IS NOT NULL THEN
        IF v_discount_code.discount_type = 'fixed_amount' THEN
            -- Convert discount_value from dollars to cents
            v_calculated_discount := (v_discount_code.discount_value * 100)::integer;
            -- Ensure discount doesn't exceed subtotal
            v_calculated_discount := LEAST(v_calculated_discount, p_subtotal_amount);
        ELSIF v_discount_code.discount_type = 'percentage' THEN
            -- Calculate percentage of subtotal
            v_calculated_discount := (p_subtotal_amount * v_discount_code.discount_value / 100)::integer;
        END IF;
    END IF;
    
    -- Return success
    is_valid := true;
    v_result_discount_code_id := v_discount_code.id;
    discount_amount := COALESCE(v_calculated_discount, 0);
    
    RETURN QUERY SELECT is_valid, v_result_discount_code_id, discount_amount, error_message;
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
        updated_at = now()
    WHERE id = p_discount_code_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.increment_discount_code_usage(uuid) TO authenticated;

-- --- End Discount Codes System ---

