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
                                        referral_name text,
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
                                        payment_date date NULL, -- Set on successful completion
                                        payment_method text NULL, -- Method might be determined by Stripe/provider
                                        status payment_status NOT NULL DEFAULT 'pending',
                                        stripe_session_id text NULL, -- Added for Stripe integration
                                        receipt_url text NULL -- Added for Stripe integration
);

-- Add columns idempotently if table already exists
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_session_id text NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_url text NULL;
-- Modify existing columns to be nullable if needed (optional, depends on if script was run before)
ALTER TABLE payments ALTER COLUMN payment_date DROP NOT NULL; -- Make payment_date nullable
ALTER TABLE payments ALTER COLUMN payment_method DROP NOT NULL; -- Make payment_method nullable


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
                                          notes text,
                                          CONSTRAINT attendance_class_date_student_id_key UNIQUE (class_date, student_id) -- Add unique constraint
);

DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes WHERE indexname = 'idx_attendance_student_id'
        ) THEN
            CREATE INDEX idx_attendance_student_id ON attendance (student_id);
        END IF;
    END$$;

-- Ensure the unique constraint exists even if the table was created previously without it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'attendance_class_date_student_id_key' AND conrelid = 'public.attendance'::regclass
    ) THEN
        ALTER TABLE public.attendance ADD CONSTRAINT attendance_class_date_student_id_key UNIQUE (class_date, student_id);
    END IF;
END;
$$;

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
('Liability Release', 'Acknowledgement of Risks and Release of Liability', E'I understand that participation in all KARATE GREENEGIN''s karate training, classes, sparring, competitions, demonstrations, belt testing, and related activities (collectively, "Karate Activities"), and/or the use of the property, facilities (dojo), and services of KARATE GREENEGIN, and the transportation to or from any KARATE GREENEGIN activities indicates my acceptance of all the below-listed Release of Liability & Assumption of Risk terms and conditions.\n\nI agree for myself, my student(s), and (if applicable) for the members of my family, to the following:\n\n1. Agreement To Follow Directions. I, my student(s), and family agree to observe and obey all posted dojo rules and warnings, and further agree to follow any oral instructions or directions given by KARATE GREENEGIN, its instructors (Sensei, Sempai), employees, representatives, volunteers, or agents.\n\n2. Assumption of the Risks and Release. I recognize that there are certain inherent risks associated with Karate Activities, including but not limited to physical contact, strikes, kicks, throws, falls, strenuous exercise, illness, injury, and/or death. I assume full responsibility for personal injury to myself, my student(s), and my family members, and further release and discharge KARATE GREENEGIN for injury, loss, or damage arising out of my, my student''s, or my family''s use of or presence upon the facilities (dojo) of KARATE GREENEGIN, and my, my student''s, or my family''s participation in KARATE GREENEGIN Activities, whether caused by the fault of myself, my student(s), my family, KARATE GREENEGIN or other third parties. I release all claims that I, my student(s), and/or my family might have based on actual or alleged negligent supervision, instruction, training, equipment (including protective gear) and/or facilities.\n\n3. Indemnification. I agree to indemnify and defend KARATE GREENEGIN against all claims, causes of action, damages, judgments, costs, or expenses, including attorney fees and other litigation costs, which may in any way arise from my, my student''s, or my family''s use of or presence upon the facilities (dojo) of KARATE GREENEGIN, and my, my student''s, or my family''s participation in KARATE GREENEGIN Activities.\n\n4. Fees. I agree to pay for all damages to the facilities (dojo) or equipment of KARATE GREENEGIN caused by any negligent, reckless, or willful actions by me, my student, or my family.\n\n5. Consent. I consent to the participation of my student(s) in Karate Activities and agree on behalf of the minor(s) to all of the terms and conditions of this agreement. By signing this Release of Liability, I represent that I have legal authority over and custody of my student(s).\n\n6. Medical Authorization. I understand that it is my sole responsibility to inform KARATE GREENEGIN of any medical conditions, concerns, or information that may affect my, my student(s), and/or my family''s ability to participate safely in Karate Activities. In the event of an injury to the above minor during Karate Activities, I give my permission to KARATE GREENEGIN or to the employees, representatives, or agents of KARATE GREENEGIN to arrange for all necessary medical treatment for which I shall be financially responsible. This temporary authority will begin upon enrollment in any/all KARATE GREENEGIN Activities, upon the use of the property, facilities (dojo), and services of KARATE GREENEGIN, and/or upon the transportation to or from any KARATE GREENEGIN activities, and will remain in effect until terminated in writing or when the Karate Activities are completed. KARATE GREENEGIN shall have the following powers:\na. The power to seek appropriate medical treatment or attention on behalf of my student(s) as may be required by the circumstances, including treatment by a physician, hospital, or other healthcare provider.\nb. The power to authorize medical treatment or medical procedures in an emergency situation; and\nc. The power to make appropriate decisions regarding clothing, bodily nourishment and shelter.\n\n7. Applicable Law. Any legal or equitable claim that may arise from participation in the above shall be resolved under British Columbian law.\n\n8. No Duress. I agree and acknowledge that I am under no pressure or duress to sign this agreement and that I have been given a reasonable opportunity to review it before signing. I further agree and acknowledge that I am free to have my own legal counsel review this agreement if I so desire. I further agree and acknowledge that KARATE GREENEGIN has offered to refund any fees I have paid to use its facilities if I choose not to sign this agreement.\n\n9. Arm''s Length Agreement. This agreement and each of its terms are the product of an arm''s length negotiation between the Parties. In the event any ambiguity is found to exist in the interpretation of this agreement or any of its provisions, the Parties, and each of them, explicitly reject the application of any legal or equitable rule of interpretation which would lead to a construction either "for" or "against" a particular party based upon their status as the drafter of a specific term, language, or provision giving rise to such ambiguity.\n\n10. Enforceability. The validity or enforceability of any provision of this agreement, whether standing alone or as applied to a particular occurrence or circumstance, shall not affect the validity or enforceability of any other provision of this agreement or of any other applications of such provision, as the case may be. Such invalid or unenforceable provision shall be deemed not to be a part of this agreement.\n\nI HAVE READ THIS DOCUMENT AND UNDERSTAND IT. I FURTHER UNDERSTAND THAT BY AGREEING TO THIS RELEASE, I VOLUNTARILY SURRENDER CERTAIN LEGAL RIGHTS.', true)
ON CONFLICT (title) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO waivers (title, description, content, required) VALUES
('Code of Conduct Agreement', 'Agreement to Adhere to School Rules and Etiquette', E'I understand that participation in all KARATE GREENEGIN''s karate training, classes, sparring, competitions, demonstrations, belt testing, and related activities (collectively, "Karate Activities"), and/or the use of the property, facilities (dojo), and services of KARATE GREENEGIN, indicates my acceptance of all the below-listed Code Of Conduct Agreement terms and conditions.\n\nI agree for myself, my student(s), and (if applicable) for the members of my family, to the following:\n\n1. Agreement To Follow Directions. I, my student(s), and family agree to observe and obey all posted dojo rules and warnings, and further agree to follow any oral instructions or directions given by KARATE GREENEGIN, its instructors (Sensei, Sempai), employees, representatives, volunteers, or agents.\n\n2. Student Commitment. I, my student(s), and family understand all KARATE GREENEGIN students are expected to;\n• Show respect (Rei) towards themselves, their peers (Kohai/Sempai), their instructors (Sensei), other authority figures, and the dojo equipment and facilities;\n• Speak and behave appropriately at all times, adhering to dojo etiquette. Refrain from disruptive behavior, foul language, or actions that may compromise the dojo''s values or safety;\n• Practice honesty and integrity (Makoto) at all times. Do not participate in: lying, cheating, misrepresentation of abilities or circumstances, or theft;\n• Demonstrate punctuality and regular attendance, being prepared (mentally and physically) and ready to learn and train;\n• Comply with the dojo''s attire / dress code policy (proper gi, belt) at all times;\n• Comply with the dojo''s technology policy (e.g., phone usage) at all times;\n• Commit to diligent practice (Keiko) both in the dojo and at home, striving for continuous improvement (Kaizen);\n• Commit to managing and maintaining personal health and hygiene, appropriate for close-contact training;\n• Commit to upholding studies and maintaining strong academic marks (if applicable);\n• Devote themselves to the positive spirit of karate and community involvement;\n• Maintain a positive attitude and serve as a role model (Sempai) for fellow students (Kohai).\n\n3. Parent/Guardian Commitment. I, my student(s), and family understand all KARATE GREENEGIN parents/guardians are expected to;\n• Show respect towards themselves, their student(s), other students and their families, the instructors (Sensei, Sempai), other authority figures, and the dojo equipment and facilities;\n• Speak and behave appropriately at all times when present at the dojo or related events. Refrain from interfering with instruction or undermining dojo discipline;\n• Model and encourage appropriate language, behavior, and respect for karate principles for their student(s). Support the instructors in handling any disciplinary issues involving their student(s);\n• Practice honesty and integrity at all times in dealings with the dojo;\n• Ensure their student(s) punctual and regular attendance, prepared and ready to train. Promptly communicate any absences or tardiness to the dojo administration;\n• Ensure their student(s) comply with the dojo''s attire / dress code policy (clean, properly worn gi and belt) at all times;\n• Ensure they and their student(s) comply with the dojo''s technology policy at all times;\n• Encourage their student(s) commitment to diligent practice both in the dojo and at home;\n• Ensure and facilitate their student(s) commitment to managing and maintaining personal health and hygiene;\n• Ensure and facilitate their student(s) commitment to upholding studies and maintaining strong academic marks (if applicable);\n• Comply with the dojo''s adult expectations (e.g., spectator conduct) outlined in the dojo handbook or posted rules;\n• Support the positive spirit of karate and community involvement;\n• Maintain a positive and supportive example for all students and families.\n• Ensure all payments, fees (tuition, testing fees, etc.), and other charges are paid promptly, do not carry an unpaid balance, and follow all payment policy terms and conditions.\n\n4. Enforcement. I understand the code of conduct will be enforced for all KARATE GREENEGIN''s students, parents/guardians, and families during all Karate Activities, as well as during the use of the property, facilities (dojo), and services of KARATE GREENEGIN, and/or when representing KARATE GREENEGIN. I understand the code of conduct will be communicated to me, my student(s), and my family through; the dojo handbook; the parent portal; email communications; and verbally by instructors. I understand that if I, my student(s), and/or my family fail to comply with the code of conduct, a maximum of two (2) warnings may be given, the first may be a verbal instructor warning, the second may be a written administration warning. Severe or repeated violations may result in immediate disciplinary action.\n\n5. Disciplinary Action. I understand that if I, my student(s), and/or my family fail to comply with the code of conduct beyond the permitted warnings, or in case of a severe violation, I, my student(s), and/or my family may be asked to leave the dojo and/or sit out of the activity, and may only be permitted to return once the conduct violation(s) have been remedied and approved by the instructors/administration. I understand that if I, my student(s), and/or my family continuously fail to comply with the code of conduct, I, my student(s), and/or my family may be suspended or removed from any/all KARATE GREENEGIN''s programs and activities, with no tuition proration or refunds granted.\n\n6. Applicable Law. Any legal or equitable claim that may arise from participation in the above shall be resolved under British Columbian law.\n\n7. No Duress. I agree and acknowledge that I am under no pressure or duress to sign this agreement and that I have been given a reasonable opportunity to review it before signing. I further agree and acknowledge that I am free to have my own legal counsel review this agreement if I so desire. I further agree and acknowledge that KARATE GREENEGIN has offered to refund any fees I have paid to use its facilities if I choose not to sign this agreement.\n\n8. Arm''s Length Agreement. This agreement and each of its terms are the product of an arm''s length negotiation between the Parties. In the event any ambiguity is found to exist in the interpretation of this agreement or any of its provisions, the Parties, and each of them, explicitly reject the application of any legal or equitable rule of interpretation which would lead to a construction either "for" or "against" a particular party based upon their status as the drafter of a specific term, language, or provision giving rise to such ambiguity.\n\n9. Enforceability. The validity or enforceability of any provision of this agreement, whether standing alone or as applied to a particular occurrence or circumstance, shall not affect the validity or enforceability of any other provision of this agreement or of any other applications of such provision, as the case may be. Such invalid or unenforceable provision shall be deemed not to be a part of this agreement.\n\nI HAVE READ THIS DOCUMENT AND UNDERSTAND IT. I FURTHER UNDERSTAND THAT BY AGREEING TO THIS AGREEMENT, I VOLUNTARILY SURRENDER CERTAIN LEGAL RIGHTS.', true)
ON CONFLICT (title) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO waivers (title, description, content, required) VALUES
('Photo/Video Consent', 'Consent for Use of Images and Videos', E'I understand that participation in all KARATE GREENEGIN''s karate training, classes, sparring, competitions, demonstrations, belt testing, and related activities (collectively, "Karate Activities"), and/or the use of the property, facilities (dojo), and services of KARATE GREENEGIN, indicates my acceptance of all the below-listed Photo / Video Release terms and conditions.\n\nI agree for myself, my student(s), and (if applicable) for the members of my family, to the following:\n\n1. Release Of Likeness. I, hereby grant KARATE GREENEGIN, and/or the related companies permission to use my, my student''s, and/or my family''s likeness in photographs and/or videos taken during Karate Activities in any/all of its publications, including but not limited to all of KARATE GREENEGIN''s printed materials (brochures, flyers), digital publications (website, social media pages, email newsletters), and promotional materials. I understand and agree that any photograph or video using my, my student''s, and/or my family''s likeness will become property of KARATE GREENEGIN and will not be returned.\n\n2. Authorization To Alter. I hereby irrevocably authorize KARATE GREENEGIN to edit, alter, copy, exhibit, publish or distribute photos and/or videos containing my, my student''s, or my family''s likeness for purposes of publicizing KARATE GREENEGIN''s programs, classes, events, competitions, achievements, or for any other related, lawful purpose (e.g., instructional materials). In addition, I waive the right to inspect or approve the finished product, including printed or digital copies, or the specific use to which it may be applied, wherein my, my student''s, and/or my family''s likeness appears.\n\n3. Fees. I acknowledge that since my, my student''s, and/or my family''s participation in KARATE GREENEGIN Activities and the use of the property, facilities (dojo), and services of KARATE GREENEGIN is voluntary, I, my student(s), and/or my family will receive no financial compensation for the use of such photographs or videos. Additionally, I waive any right to royalties or other compensation arising or related to the use of the photograph and/or video.\n\n4. Indemnification. I hereby hold harmless and release and forever discharge KARATE GREENEGIN from all claims, demands, and causes of action which I, my student(s), my family, my heirs, representatives, executors, administrators, or any other persons acting on my behalf or on behalf of my estate have or may have by reason of this authorization and release.\n\n5. Applicable Law. Any legal or equitable claim that may arise from participation in the above shall be resolved under British Columbian law.\n\n6. No Duress. I agree and acknowledge that I am under no pressure or duress to sign this agreement and that I have been given a reasonable opportunity to review it before signing. I further agree and acknowledge that I am free to have my own legal counsel review this agreement if I so desire. I further agree and acknowledge that KARATE GREENEGIN has offered to refund any fees I have paid to use its facilities if I choose not to sign this agreement.\n\n7. Arm''s Length Agreement. This agreement and each of its terms are the product of an arm''s length negotiation between the Parties. In the event any ambiguity is found to exist in the interpretation of this agreement or any of its provisions, the Parties, and each of them, explicitly reject the application of any legal or equitable rule of interpretation which would lead to a construction either "for" or "against" a particular party based upon their status as the drafter of a specific term, language, or provision giving rise to such ambiguity.\n\n8. Enforceability. The validity or enforceability of any provision of this agreement, whether standing alone or as applied to a particular occurrence or circumstance, shall not affect the validity or enforceability of any other provision of this agreement or of any other applications of such provision, as the case may be. Such invalid or unenforceable provision shall be deemed not to be a part of this agreement.\n\nI HAVE READ THIS DOCUMENT AND UNDERSTAND IT. I FURTHER UNDERSTAND THAT BY AGREEING TO THIS RELEASE, I VOLUNTARILY SURRENDER CERTAIN LEGAL RIGHTS.', true)
ON CONFLICT (title) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO waivers (title, description, content, required) VALUES
('Payment Policy', 'Acknowledgement of Financial Obligations', E'I understand that participation in all KARATE GREENEGIN''s karate training, classes, sparring, competitions, demonstrations, belt testing, and related activities (collectively, "Karate Activities"), and/or the use of the property, facilities (dojo), and services of KARATE GREENEGIN, indicates my acceptance of all the below-listed Payment Policy terms and conditions.\n\nI agree for myself, my student(s), and (if applicable) for the members of my family, to the following:\n\n1. Commitment To Payment. I understand that participation in all KARATE GREENEGIN''s Karate Activities, and/or the use of the property, facilities (dojo), and services of KARATE GREENEGIN, indicates my commitment to pay the full tuition, testing fees, and/or associated costs as outlined by KARATE GREENEGIN.\n\n2. When Payment Is Due. I understand that program tuition amounts (e.g., monthly, term-based) are due as specified by KARATE GREENEGIN (e.g., on or before the 1st or 15th of the month/term prior to service). I understand specific fees for events like belt testing, competitions, or special seminars must be paid by their respective deadlines. I understand any introductory offers, trial periods, or initial registration fees must be paid in full upon enrollment.\n\n3. Forms Of Payment Accepted. I understand KARATE GREENEGIN accepts online payments through the parent portal via Amex, Discover, Mastercard, and Visa. Other payment methods may be accepted at the discretion of KARATE GREENEGIN administration.\n\n4. Discount Terms And Conditions. I understand KARATE GREENEGIN may offer discounts such as Multi-Class, Multi-Student (Family), or specific program discounts. Current discount details, eligibility, and terms (e.g., whether they can be combined) are available from KARATE GREENEGIN administration or on the website/portal. I understand these are the only discounts KARATE GREENEGIN currently offers unless otherwise specified in writing.\n\n5. Scholarship Terms And Conditions. I understand KARATE GREENEGIN may offer scholarships or financial assistance based on need and availability. Application procedures, requirements, and award details (e.g., percentage, applicable fees) are available from KARATE GREENEGIN administration. I understand that any misrepresentation of financial need or merit is grounds for scholarship termination, and I would be solely responsible for returning any scholarship amounts awarded.\n\n6. Late Payments. I understand payments not received by the specified due date are considered late. I understand that late payments may incur a late fee (e.g., $25.00) after a grace period (e.g., three (3) days). I understand any overdue fees not received by a specified date (e.g., the first (1st) of the following month) may result in student(s) being temporarily suspended from participation in Karate Activities until full payment is received. I understand any/all late payment grace periods are intended solely for financial flexibility, and I agree not to exploit this convenience.\n\n7. Absences. I understand if a student is absent for any/all personal reasons (sick, family trip, etc.) I will still be charged tuition for the period covered. I understand KARATE GREENEGIN generally does not offer refunds or fee reimbursements for student absences. I understand select KARATE GREENEGIN classes may be eligible for a ‘makeup class’, subject to availability and dojo policy. I understand statutory holidays may be excluded from tuition fees if the dojo is closed, as per the official schedule.\n\n8. Cancellations & Refunds. I understand my enrollment in any KARATE GREENEGIN program requires I pay the tuition amount for the committed term (e.g., month, session). I understand the specific cancellation policy, including notice periods and any financial obligations for early termination (e.g., paying for the current term), is outlined by KARATE GREENEGIN. I understand refunds are generally only issued under specific circumstances (e.g., long-term injury with doctor''s note) and may be subject to administrative fees, as per dojo policy. I understand payments might be transferable to another KARATE GREENEGIN program or term only at the discretion of the administration. I agree to contact the KARATE GREENEGIN administration team regarding any extraneous circumstances where I believe a refund or cancellation exception is warranted.\n\n9. Applicable Law. Any legal or equitable claim that may arise from participation or financial obligations related to the above shall be resolved under British Columbian law.\n\n10. No Duress. I agree and acknowledge that I am under no pressure or duress to sign this agreement and that I have been given a reasonable opportunity to review it before signing. I further agree and acknowledge that I am free to have my own legal counsel review this agreement if I so desire. I further agree and acknowledge that KARATE GREENEGIN has offered to refund any fees I have paid to use its facilities if I choose not to sign this agreement.\n\n11. Arm''s Length Agreement. This agreement and each of its terms are the product of an arm''s length negotiation between the Parties. In the event any ambiguity is found to exist in the interpretation of this agreement or any of its provisions, the Parties, and each of them, explicitly reject the application of any legal or equitable rule of interpretation which would lead to a construction either "for" or "against" a particular party based upon their status as the drafter of a specific term, language, or provision giving rise to such ambiguity.\n\n12. Enforceability. The validity or enforceability of any provision of this agreement, whether standing alone or as applied to a particular occurrence or circumstance, shall not affect the validity or enforceability of any other provision of this agreement or of any other applications of such provision, as the case may be. Such invalid or unenforceable provision shall be deemed not to be a part of this agreement.\n\nI HAVE READ THIS DOCUMENT AND UNDERSTAND IT. I FURTHER UNDERSTAND THAT BY AGREEING TO THIS POLICY, I VOLUNTARILY SURRENDER CERTAIN LEGAL RIGHTS.', true)
ON CONFLICT (title) DO UPDATE SET content = EXCLUDED.content;

INSERT INTO waivers (title, description, content, required) VALUES
('Dress Code Agreement', 'Acknowledgement of Attire Requirements', E'I understand that participation in all KARATE GREENEGIN''s Karate Activities, and/or the use of the property, facilities (dojo), and services of KARATE GREENEGIN, indicates my acceptance of all the below-listed Attire / Dress Code Agreement terms and conditions.\n\nI agree for myself, my student(s), and (if applicable) for the members of my family, to the following:\n\n1. Agreement To Follow Directions. I, my student(s), and/or family agree to follow KARATE GREENEGIN guidelines for dress code and attire during all Karate Activities, during use of the property, facilities (dojo), and services of KARATE GREENEGIN, and/or when representing KARATE GREENEGIN (e.g., at competitions, demonstrations). I, my student(s), and/or family agree to observe and obey all posted rules and warnings regarding attire, and further agree to follow any oral instructions or directions given by KARATE GREENEGIN instructors (Sensei, Sempai) or staff. I understand that specific attire guidelines can be found in the dojo handbook or obtained from KARATE GREENEGIN administration (website: greeneginkarate.ca).\n\n2. Acceptable Attire (Karate Gi). I understand the primary acceptable attire for karate training is the official KARATE GREENEGIN uniform (Gi), consisting of jacket, pants, and belt appropriate to the student''s rank. I understand the Gi must be kept clean, in good repair (no rips or tears), and worn correctly as instructed. I understand that for certain activities (e.g., trial classes, specific workshops, fitness components), alternative appropriate athletic wear (e.g., t-shirt, athletic pants/shorts) may be permitted as specified by instructors. I understand hair must be kept neat and tied back if long enough to obstruct vision or interfere with training. I understand personal grooming must be kept clean and tidy, and nails trimmed short for safety.\n\n3. Unacceptable Attire. I understand unacceptable attire for regular karate training includes: street clothes (jeans, non-athletic wear); clothing with offensive graphics or language; excessively baggy or revealing clothing; jewelry (rings, necklaces, bracelets, earrings - small stud earrings may be permissible at instructor discretion but must be taped if requested); shoes on the training mat (unless specific mat shoes are approved for medical reasons); dirty or damaged Gis. I understand hair must not be styled in a way that interferes with training or safety (e.g., requires constant adjustment). I understand personal grooming must meet hygiene standards suitable for close contact training (e.g., absence of strong perfumes/colognes, regular showering).\n\n4. Enforcement. I understand the dress code will be enforced for all KARATE GREENEGIN Activities. I understand instructors have the authority to determine if attire is appropriate and safe. I understand dress code expectations will be communicated through the dojo handbook, website/portal, email communications, and verbally by instructors. I understand that if I, my student(s), and/or my family fail to comply with the dress code, a warning may be given. Repeated non-compliance may result in being asked not to participate in that day''s training.\n\n5. Disciplinary Action. I understand that if I, my student(s), and/or my family continuously fail to comply with the dress code, participation in Karate Activities may be restricted until the issue is resolved. In persistent cases, this may be treated as a violation of the Code of Conduct and could lead to suspension or removal from programs without refund or proration.\n\n6. Applicable Law. Any legal or equitable claim that may arise from participation related to attire shall be resolved under British Columbian law.\n\n7. No Duress. I agree and acknowledge that I am under no pressure or duress to sign this agreement and that I have been given a reasonable opportunity to review it before signing. I further agree and acknowledge that I am free to have my own legal counsel review this agreement if I so desire. I further agree and acknowledge that KARATE GREENEGIN has offered to refund any fees I have paid to use its facilities if I choose not to sign this agreement.\n\n8. Arm''s Length Agreement. This agreement and each of its terms are the product of an arm''s length negotiation between the Parties. In the event any ambiguity is found to exist in the interpretation of this agreement or any of its provisions, the Parties, and each of them, explicitly reject the application of any legal or equitable rule of interpretation which would lead to a construction either "for" or "against" a particular party based upon their status as the drafter of a specific term, language, or provision giving rise to such ambiguity.\n\n9. Enforceability. The validity or enforceability of any provision of this agreement, whether standing alone or as applied to a particular occurrence or circumstance, shall not affect the validity or enforceability of any other provision of this agreement or of any other applications of such provision, as the case may be. Such invalid or unenforceable provision shall be deemed not to be a part of this agreement.\n\nI HAVE READ THIS DOCUMENT AND UNDERSTAND IT. I FURTHER UNDERSTAND THAT BY AGREEING TO THIS AGREEMENT, I VOLUNTARILY SURRENDER CERTAIN LEGAL RIGHTS.', true)
ON CONFLICT (title) DO UPDATE SET content = EXCLUDED.content;


-- Waiver Signatures table with enhanced structure
DROP TABLE IF EXISTS waiver_signatures CASCADE;
CREATE TABLE IF NOT EXISTS waiver_signatures (
                                                 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                                                 waiver_id uuid REFERENCES waivers(id) ON DELETE CASCADE NOT NULL,
                                                 user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
                                                 signed_at timestamptz NOT NULL DEFAULT now(),
                                                 signature_data text NOT NULL,
                                                 agreement_version text NOT NULL,  -- Add version tracking
                                                 CONSTRAINT unique_waiver_signature UNIQUE (waiver_id, user_id)  -- Prevent duplicate signatures
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

-- Policy Agreements table removed in favor of enhanced waiver_signatures

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
-- policy_agreements table removed
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

        -- Enhanced waiver_signatures RLS policies
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'waiver_signatures' AND policyname = 'Users can view their waiver signatures'
        ) THEN
            CREATE POLICY "Users can view their waiver signatures" ON waiver_signatures
                FOR SELECT USING (auth.uid() = user_id);
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE tablename = 'waiver_signatures' AND policyname = 'Admins can manage waiver signatures'
        ) THEN
            CREATE POLICY "Admins can manage waiver signatures" ON waiver_signatures
                FOR ALL TO authenticated
                USING (EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.role = 'admin'
                ));
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
