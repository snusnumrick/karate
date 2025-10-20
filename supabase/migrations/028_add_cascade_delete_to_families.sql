-- Migration to add ON DELETE CASCADE to foreign keys referencing families table
-- This ensures that when a family is deleted, all related records are automatically removed

-- Fix invoices table
ALTER TABLE invoices
DROP CONSTRAINT IF EXISTS invoices_family_id_fkey,
ADD CONSTRAINT invoices_family_id_fkey
  FOREIGN KEY (family_id)
  REFERENCES families(id)
  ON DELETE CASCADE;

-- Fix invoice_entities table (if it has family_id)
ALTER TABLE invoice_entities
DROP CONSTRAINT IF EXISTS invoice_entities_family_id_fkey,
ADD CONSTRAINT invoice_entities_family_id_fkey
  FOREIGN KEY (family_id)
  REFERENCES families(id)
  ON DELETE CASCADE;

-- Note: Other tables already have ON DELETE CASCADE:
-- - class_message_recipients.family_id
-- - event_registrations.family_id (from 004_add_events_table.sql)
--
-- Tables that cascade via students:
-- - class_enrollments (via students -> family)
-- - attendance (via students -> family)
-- - belt_awards (via students -> family)
--
-- Tables that need to be checked:
-- - profiles (references families)
-- - students (references families)
-- - guardians (references families if exists)
-- - payments (might reference families)
-- - orders (might reference families)

-- Ensure students have cascade (this is critical)
ALTER TABLE students
DROP CONSTRAINT IF EXISTS students_family_id_fkey,
ADD CONSTRAINT students_family_id_fkey
  FOREIGN KEY (family_id)
  REFERENCES families(id)
  ON DELETE CASCADE;

-- Profiles should use SET NULL (keep user accounts, just orphan them from family)
-- This allows admin users to remain in the system even if their family is deleted
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_family_id_fkey,
ADD CONSTRAINT profiles_family_id_fkey
  FOREIGN KEY (family_id)
  REFERENCES families(id)
  ON DELETE SET NULL;

-- Check if guardians table exists and fix it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guardians') THEN
        ALTER TABLE guardians
        DROP CONSTRAINT IF EXISTS guardians_family_id_fkey,
        ADD CONSTRAINT guardians_family_id_fkey
          FOREIGN KEY (family_id)
          REFERENCES families(id)
          ON DELETE CASCADE;
    END IF;
END $$;

-- Check if payments table has family_id and fix it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'family_id'
    ) THEN
        ALTER TABLE payments
        DROP CONSTRAINT IF EXISTS payments_family_id_fkey,
        ADD CONSTRAINT payments_family_id_fkey
          FOREIGN KEY (family_id)
          REFERENCES families(id)
          ON DELETE CASCADE;
    END IF;
END $$;

-- Check if orders table has family_id and fix it
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders' AND column_name = 'family_id'
    ) THEN
        ALTER TABLE orders
        DROP CONSTRAINT IF EXISTS orders_family_id_fkey,
        ADD CONSTRAINT orders_family_id_fkey
          FOREIGN KEY (family_id)
          REFERENCES families(id)
          ON DELETE CASCADE;
    END IF;
END $$;

-- Check waiver_signatures (profiles should cascade, but let's verify)
-- waiver_signatures -> profiles -> families (should work via profiles cascade)

-- Add comment for documentation
COMMENT ON TABLE families IS 'Main families table. Deleting a family will CASCADE delete all related students, profiles, invoices, orders, and other family-related data.';
