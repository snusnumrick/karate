-- Run this in your Supabase SQL Editor
-- This script is idempotent - safe to run multiple times without duplicating data

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Create or modify payment_status enum
DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
            CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed');
        END IF;
    END$$;

-- Create tables with IF NOT EXISTS to avoid errors on subsequent runs

-- Families table
CREATE TABLE IF NOT EXISTS families (
                                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                        name text NOT NULL,
                                        address text NOT NULL,
                                        city text NOT NULL,
                                        province text NOT NULL,
                                        postal_code varchar(10) NOT NULL,
                                        primary_phone varchar(20) NOT NULL,
                                        email text NOT NULL,
                                        referral_source text,
                                        emergency_contact text,
                                        health_info text,
                                        created_at timestamptz DEFAULT now(),
                                        updated_at timestamptz DEFAULT now()
);

-- Example: Add a column to an existing table idempotently
ALTER TABLE families ADD COLUMN IF NOT EXISTS notes text;


-- Guardians table
CREATE TABLE IF NOT EXISTS guardians (
                                         id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                         family_id uuid REFERENCES families(id) ON DELETE CASCADE NOT NULL,
                                         first_name text NOT NULL,
                                         last_name text NOT NULL,
                                         relationship text NOT NULL,
                                         home_phone varchar(20) NOT NULL,
                                         work_phone varchar(20),
                                         cell_phone varchar(20) NOT NULL,
                                         email text NOT NULL,
                                         employer text,
                                         employer_phone varchar(20),
                                         employer_notes text
);

-- Create indexes if they don't exist
DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = 'idx_guardians_family_id'
        ) THEN
            CREATE INDEX idx_guardians_family_id ON guardians (family_id);
        END IF;
    END$$;

-- Students table
CREATE TABLE IF NOT EXISTS students (
                                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                        family_id uuid REFERENCES families(id) ON DELETE CASCADE NOT NULL,
                                        first_name text NOT NULL,
                                        last_name text NOT NULL,
                                        gender text NOT NULL,
                                        birth_date date NOT NULL,
                                        belt_rank text,
                                        t_shirt_size text NOT NULL,
                                        school text NOT NULL,
                                        grade_level text,
                                        cell_phone varchar(20),
                                        email text,
                                        immunizations_up_to_date text,
                                        immunization_notes text,
                                        allergies text,
                                        medications text,
                                        special_needs text
);

DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = 'idx_students_family_id'
        ) THEN
            CREATE INDEX idx_students_family_id ON students (family_id);
        END IF;
    END$$;

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
                                        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                        family_id uuid REFERENCES families(id) ON DELETE CASCADE NOT NULL,
                                        amount numeric(10,2) NOT NULL,
                                        payment_date date NOT NULL,
                                        payment_method text NOT NULL,
                                        status payment_status NOT NULL DEFAULT 'pending'
);

DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payments_family_id'
        ) THEN
            CREATE INDEX idx_payments_family_id ON payments (family_id);
        END IF;
    END$$;

-- Payment-Students junction table
CREATE TABLE IF NOT EXISTS payment_students (
                                                id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                                payment_id uuid REFERENCES payments(id) ON DELETE CASCADE NOT NULL,
                                                student_id uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL
);

DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_students_payment_id'
        ) THEN
            CREATE INDEX idx_payment_students_payment_id ON payment_students (payment_id);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payment_students_student_id'
        ) THEN
            CREATE INDEX idx_payment_students_student_id ON payment_students (student_id);
        END IF;
    END$$;

-- Achievements table
CREATE TABLE IF NOT EXISTS achievements (
                                            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                            student_id uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
                                            type text NOT NULL,
                                            description text NOT NULL,
                                            awarded_date date NOT NULL
);

DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = 'idx_achievements_student_id'
        ) THEN
            CREATE INDEX idx_achievements_student_id ON achievements (student_id);
        END IF;
    END$$;

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
                                          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                          student_id uuid REFERENCES students(id) ON DELETE CASCADE NOT NULL,
                                          class_date date NOT NULL,
                                          present boolean NOT NULL,
                                          notes text
);

DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = 'idx_attendance_student_id'
        ) THEN
            CREATE INDEX idx_attendance_student_id ON attendance (student_id);
        END IF;
    END$$;

-- Waivers table
CREATE TABLE IF NOT EXISTS waivers (
                                       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                       title text NOT NULL,
                                       description text NOT NULL,
                                       content text NOT NULL,
                                       required boolean NOT NULL DEFAULT false,
                                       CONSTRAINT waivers_title_unique UNIQUE (title) -- Ensure title is unique for ON CONFLICT
);

-- Ensure the unique constraint exists even if the table was created previously without it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'waivers_title_unique' AND conrelid = 'public.waivers'::regclass
    ) THEN
        ALTER TABLE public.waivers ADD CONSTRAINT waivers_title_unique UNIQUE (title);
    END IF;
END;
$$;

-- Insert standard waivers (Use ON CONFLICT to make idempotent)
-- IMPORTANT: Replace placeholder content with legally reviewed text for BC.
INSERT INTO waivers (title, description, content, required) VALUES
('Liability Release', 'Acknowledgement of Risks and Release of Liability', E'Placeholder Content: I, the undersigned parent/guardian, acknowledge the inherent risks associated with karate training, including but not limited to physical injury. I hereby release [Your Karate School Name], its instructors, and affiliates from any liability for injuries sustained by my child during participation.\n\n[Consult a legal professional in BC for appropriate wording]', true)
ON CONFLICT (title) DO NOTHING;

INSERT INTO waivers (title, description, content, required) VALUES
('Code of Conduct Agreement', 'Agreement to Adhere to School Rules and Etiquette', E'Placeholder Content: I, the undersigned parent/guardian, and my child agree to abide by the rules, regulations, and code of conduct of [Your Karate School Name], promoting respect, discipline, and safety.\n\n[Consult a legal professional in BC for appropriate wording]', true)
ON CONFLICT (title) DO NOTHING;

INSERT INTO waivers (title, description, content, required) VALUES
('Photo/Video Consent', 'Consent for Use of Images and Videos', E'Placeholder Content: I, the undersigned parent/guardian, grant [Your Karate School Name] permission to use photographs and/or videos of my child taken during classes or events for promotional purposes (website, social media, brochures) without compensation.\n\n[Consult a legal professional in BC for appropriate wording]', true)
ON CONFLICT (title) DO NOTHING;

INSERT INTO waivers (title, description, content, required) VALUES
('Payment and Dress Code Agreement', 'Acknowledgement of Financial Obligations and Attire Requirements', E'Placeholder Content: I, the undersigned parent/guardian, understand and agree to the payment schedule, fees, and refund policy of [Your Karate School Name]. I also agree to ensure my child adheres to the required dress code/uniform policy.\n\n[Consult a legal professional in BC for appropriate wording]', true)
ON CONFLICT (title) DO NOTHING;


-- Waiver Signatures table
CREATE TABLE IF NOT EXISTS waiver_signatures (
                                                 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                                 waiver_id uuid REFERENCES waivers(id) ON DELETE CASCADE NOT NULL,
                                                 user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
                                                 signature_data text NOT NULL,
                                                 signed_at timestamptz DEFAULT now()
);

DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = 'idx_waiver_signatures_user_id'
        ) THEN
            CREATE INDEX idx_waiver_signatures_user_id ON waiver_signatures (user_id);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = 'idx_waiver_signatures_waiver_id'
        ) THEN
            CREATE INDEX idx_waiver_signatures_waiver_id ON waiver_signatures (waiver_id);
        END IF;
    END$$;

-- Policy Agreements table
CREATE TABLE IF NOT EXISTS policy_agreements (
                                                 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                                 family_id uuid REFERENCES families(id) ON DELETE CASCADE NOT NULL,
                                                 full_name text NOT NULL,
                                                 photo_release boolean NOT NULL,
                                                 liability_release boolean NOT NULL,
                                                 code_of_conduct boolean NOT NULL,
                                                 payment_policy boolean NOT NULL,
                                                 attire_agreement boolean NOT NULL,
                                                 signature_date timestamptz NOT NULL DEFAULT now()
);

DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = 'idx_policy_agreements_family_id'
        ) THEN
            CREATE INDEX idx_policy_agreements_family_id ON policy_agreements (family_id);
        END IF;
    END$$;

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
                                        id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
                                        email text NOT NULL,
                                        role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'instructor')),
                                        family_id uuid REFERENCES families(id) ON DELETE SET NULL
);

DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = 'idx_profiles_family_id'
        ) THEN
            CREATE INDEX idx_profiles_family_id ON profiles (family_id);
        END IF;
    END$$;

-- Drop existing triggers first to avoid conflicts when recreating
DROP TRIGGER IF EXISTS families_updated ON families;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if it doesn't exist
DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
        ) THEN
            CREATE TRIGGER on_auth_user_created
                AFTER INSERT ON auth.users
                FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
        END IF;
    END$$;

-- Enable row level security on all tables
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE waivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiver_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Add RLS policies conditionally
DO $$
    BEGIN
        -- Check if policy exists before creating
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'profiles' AND policyname = 'Profiles are viewable by user'
        ) THEN
            CREATE POLICY "Profiles are viewable by user" ON profiles
                FOR SELECT USING (auth.uid() = id);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'families' AND policyname = 'Families are viewable by members'
        ) THEN
            CREATE POLICY "Families are viewable by members" ON families
                FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.family_id = families.id
                      AND profiles.id = auth.uid()
                )
                );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'guardians' AND policyname = 'Guardians are viewable by family members'
        ) THEN
            CREATE POLICY "Guardians are viewable by family members" ON guardians
                FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.family_id = guardians.family_id
                      AND profiles.id = auth.uid()
                )
                );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'students' AND policyname = 'Students are viewable by family members'
        ) THEN
            CREATE POLICY "Students are viewable by family members" ON students
                FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.family_id = students.family_id
                      AND profiles.id = auth.uid()
                )
                );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'payments' AND policyname = 'Payments are viewable by family members'
        ) THEN
            CREATE POLICY "Payments are viewable by family members" ON payments
                FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.family_id = payments.family_id
                      AND profiles.id = auth.uid()
                )
                );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'payment_students' AND policyname = 'Payment_students are viewable by related users'
        ) THEN
            CREATE POLICY "Payment_students are viewable by related users" ON payment_students
                FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM payments
                                      JOIN profiles ON profiles.family_id = payments.family_id
                    WHERE payment_students.payment_id = payments.id
                      AND profiles.id = auth.uid()
                )
                );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'achievements' AND policyname = 'Achievements are viewable by family members'
        ) THEN
            CREATE POLICY "Achievements are viewable by family members" ON achievements
                FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM students
                                      JOIN profiles ON profiles.family_id = students.family_id
                    WHERE achievements.student_id = students.id
                      AND profiles.id = auth.uid()
                )
                );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'attendance' AND policyname = 'Attendance is viewable by family members'
        ) THEN
            CREATE POLICY "Attendance is viewable by family members" ON attendance
                FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM students
                                      JOIN profiles ON profiles.family_id = students.family_id
                    WHERE attendance.student_id = students.id
                      AND profiles.id = auth.uid()
                )
                );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'waivers' AND policyname = 'Waivers are viewable by all authenticated users'
        ) THEN
            CREATE POLICY "Waivers are viewable by all authenticated users" ON waivers
                FOR SELECT USING (auth.role() = 'authenticated');
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'waiver_signatures' AND policyname = 'Waiver signatures are viewable by the signer'
        ) THEN
            CREATE POLICY "Waiver signatures are viewable by the signer" ON waiver_signatures
                FOR SELECT USING (auth.uid() = user_id);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'policy_agreements' AND policyname = 'Policy agreements are viewable by family members'
        ) THEN
            CREATE POLICY "Policy agreements are viewable by family members" ON policy_agreements
                FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM profiles
                    WHERE profiles.family_id = policy_agreements.family_id
                      AND profiles.id = auth.uid()
                )
                );
        END IF;
    END$$;

-- Add validation constraints conditionally
DO $$
    BEGIN
        -- Check if constraint exists before adding
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'valid_province'
        ) THEN
            ALTER TABLE families
                ADD CONSTRAINT valid_province
                    CHECK (province IN ('AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'));
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'valid_t_shirt_size'
        ) THEN
            ALTER TABLE students
                ADD CONSTRAINT valid_t_shirt_size
                    CHECK (t_shirt_size IN ('YXS','YS','YM','YL','YXL','AS','AM','AL','AXL','A2XL'));
        END IF;
    END$$;

-- Add update timestamp triggers
CREATE OR REPLACE FUNCTION update_modified_column()
    RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create trigger if it doesn't exist
DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger WHERE tgname = 'families_updated'
        ) THEN
            CREATE TRIGGER families_updated
                BEFORE UPDATE ON families
                FOR EACH ROW EXECUTE FUNCTION update_modified_column();
        END IF;
    END$$;

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
