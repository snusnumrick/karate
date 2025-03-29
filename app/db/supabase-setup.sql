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
('Liability Release', 'Acknowledgement of Risks and Release of Liability', E'I understand that participation in all Limelight Performing Arts'' programs, courses, classes, workshops, rehearsals, performances, events, competitions, trips and all related activities, and/or the use of the property, facilities, and services of Limelight Performing Arts, and the transportation to or from all Limelight Performing Arts activities indicates my acceptance of all the below-listed Release of Liability & Assumption of Risk terms and conditions.\n\nI agree for myself, my student(s), and (if applicable) for the members of my family, to the following:\n\n1. Agreement To Follow Directions. I, my student(s), and family agree to observe and obey all posted rules and warnings, and further agree to follow any oral instructions or directions given by Limelight Performing Arts, or the related companies, associations, owners, managers, instructors, employees, representatives, volunteers, or agents of Limelight Performing Arts.\n\n2. Assumption of the Risks and Release. I recognize that there are certain inherent risks associated with the above-described activities, including but not limited to illness, injury, and/or death, and I assume full responsibility for personal injury to myself, my student(s), and my family members, and further release and discharge Limelight Performing Arts for injury, loss, or damage arising out of my, my student''s, or my family''s use of or presence upon the facilities of Limelight Performing Arts, and my, my student''s, or my family''s participation in Limelight Performing Arts activities, whether caused by the fault of myself, my student(s), my family, Limelight Performing Arts or other third parties. I release all claims that I, my student(s), and/or my family might have based on actual or alleged negligent supervision, instruction, training, equipment and/or facilities.\n\n3. Indemnification. I agree to indemnify and defend Limelight Performing Arts against all claims, causes of action, damages, judgments, costs, or expenses, including attorney fees and other litigation costs, which may in any way arise from my, my student''s, or my family''s use of or presence upon the facilities of Limelight Performing Arts, and my, my student''s, or my family''s participation in Limelight Performing Arts activities.\n\n4. Fees. I agree to pay for all damages to the facilities of Limelight Performing Arts caused by any negligent, reckless, or willful actions by me, my student, or my family.\n\n5. Consent. I consent to the participation of my student(s) in the activity and agree on behalf of the minor(s) to all of the terms and conditions of this agreement. By signing this Release of Liability, I represent that I have legal authority over and custody of my student(s).\n\n6. Medical Authorization. I understand that it is my sole responsibility to inform Limelight Performing Arts of any medical conditions, concerns, or information that may affect my, my student(s), and/or my family''s ability to participate in the above-described activities. In the event of an injury to the above minor during the above-described activities, I give my permission to Limelight Performing Arts or to the employees, representatives, or agents of Limelight Performing Arts to arrange for all necessary medical treatment for which I shall be financially responsible. This temporary authority will begin upon enrollment in any/all Limelight Performing Arts'' programs, courses, classes, workshops, rehearsals, performances, events, competitions, trips and all related activities, upon the use of the property, facilities, and services of Limelight Performing Arts, and/or upon the transportation to or from all Limelight Performing Arts activities, and will remain in effect until terminated in writing or when the above-described activities are completed. Limelight Performing Arts shall have the following powers:\na. The power to seek appropriate medical treatment or attention on behalf of my student(s) as may be required by the circumstances, including treatment by a physician, hospital, or other healthcare provider.\nb. The power to authorize medical treatment or medical procedures in an emergency situation; and\nc. The power to make appropriate decisions regarding clothing, bodily nourishment and shelter.\n\n7. Applicable Law. Any legal or equitable claim that may arise from participation in the above shall be resolved under British Columbian law.\n\n8. No Duress. I agree and acknowledge that I am under no pressure or duress to sign this agreement and that I have been given a reasonable opportunity to review it before signing. I further agree and acknowledge that I am free to have my own legal counsel review this agreement if I so desire. I further agree and acknowledge that Limelight Performing Arts has offered to refund any fees I have paid to use its facilities if I choose not to sign this agreement.\n\n9. Arm''s Length Agreement. This agreement and each of its terms are the product of an arm''s length negotiation between the Parties. In the event any ambiguity is found to exist in the interpretation of this agreement or any of its provisions, the Parties, and each of them, explicitly reject the application of any legal or equitable rule of interpretation which would lead to a construction either "for" or "against" a particular party based upon their status as the drafter of a specific term, language, or provision giving rise to such ambiguity.\n\n10. Enforceability. The validity or enforceability of any provision of this agreement, whether standing alone or as applied to a particular occurrence or circumstance, shall not affect the validity or enforceability of any other provision of this agreement or of any other applications of such provision, as the case may be. Such invalid or unenforceable provision shall be deemed not to be a part of this agreement.\n\nI HAVE READ THIS DOCUMENT AND UNDERSTAND IT. I FURTHER UNDERSTAND THAT BY AGREEING TO THIS RELEASE, I VOLUNTARILY SURRENDER CERTAIN LEGAL RIGHTS.', true)
ON CONFLICT (title) DO NOTHING;

INSERT INTO waivers (title, description, content, required) VALUES
('Code of Conduct Agreement', 'Agreement to Adhere to School Rules and Etiquette', E'I understand that participation in all Limelight Performing Arts'' programs, courses, classes, workshops, rehearsals, performances, events, competitions, trips and all related activities, and/or the use of the property, facilities, and services of Limelight Performing Arts, indicates my acceptance of all the below-listed Code Of Conduct Agreement terms and conditions.\n\nI agree for myself, my student(s), and (if applicable) for the members of my family, to the following:\n\n1. Agreement To Follow Directions. I, my student(s), and family agree to observe and obey all posted rules and warnings, and further agree to follow any oral instructions or directions given by Limelight Performing Arts, or the related companies, associations, owners, managers, instructors, employees, representatives, volunteers, or agents of Limelight Performing Arts.\n\n2. Student Commitment. I, my student(s), and family understand all Limelight Performing Arts students are expected to;\n• Show respect towards themselves, their peers, their instructors, other authority figures, and the studio equipment and facilities;\n• Speak and behave appropriately at all times. Refrain from speaking of, partaking in, or bringing anything to the studio that may compromise the studio''s values or safety;\n• Practice honesty and integrity at all times. Do not participate in: lying, cheating, misrepresentation of original work, misrepresentation of circumstances, or theft;\n• Demonstrate punctual and regular attendance, being prepared and ready to learn, given the individual''s circumstances;\n• Comply with the studio''s attire / dress code policy at all times;\n• Comply with the studio''s technology policy at all times;\n• Commit to routine studio and at home practice, to ensure fullest performance ability;\n• Commit to managing and maintaining personal athlete health;\n• Commit to upholding studies and maintaining strong academic marks;\n• Devote themselves to studio and community involvement;\n• Maintain a mentorship/role model example for fellow students.\n\n3. Parent/Guardian Commitment. I, my student(s), and family understand all Limelight Performing Arts parents/guardians are expected to;\n• Show respect towards themselves, their student(s), other students and their families, their students'' instructors, other authority figures, and the studio equipment and facilities;\n• Speak and behave appropriately at all times. Refrain from speaking of, partaking in, or bringing anything to the studio that may compromise the studio''s values or safety;\n• Model and encourage appropriate language and behavior for their student(s). Assist the studio in handling any disciplinary issues involving their student(s);\n• Practice honesty and integrity at all times. Do not participate in: lying, cheating, theft of evaluation instruments, false representation of circumstances, or misrepresentation of original work;\n• Ensure their student(s) punctual and regular attendance, being prepared and ready to learn, given the individual''s circumstances. Promptly communicate any absences or tardiness;\n• Ensure their student(s) comply with the studio''s attire / dress code policy at all times;\n• Ensure they and their student(s) comply with the studio''s technology policy at all times;\n• Ensure their student(s) commit to routine studio and at home practice, to ensure fullest performance ability;\n• Ensure and facilitate their student(s) commit to managing and maintaining personal athlete health;\n• Ensure and facilitate their student(s) commit to upholding studies and maintaining strong academic marks;\n• Comply with the studio''s adult attire expectations outlined in the studio handbook;\n• Devote themselves to studio and community involvement;\n• Maintain a mentorship/role model example for all students, and families.\n• Ensure all payments, fees, and other charges are paid promptly, do not carry an unpaid balance, and follow all payment policy terms and conditions.\n\n4. Enforcement. I understand the code of conduct will be enforced for all Limelight Performing Arts'' students, parents/guardians, and families during all programs, courses, classes, workshops, rehearsals, performances, events, competitions, trips and all related activities, as well as during the use of the property, facilities, and services of Limelight Performing Arts, and/or when representing Limelight Performing Arts. I understand the code of conduct will be communicated to me, my student(s), and my family through; the studio handbook; the parent portal; email communications; and verbally by instructors. I understand that if I, my student(s), and/or my family fail to comply with the code of conduct, a maximum of two (2) warnings will be given, the first will be a verbal instructor warning, the second will be a written administration warning.\n\n5. Disciplinary Action. I understand that if I, my student(s), and/or my family fail to comply with the code of conduct beyond the permitted two (2) warnings, I, my student(s), and/or my family may be asked to leave and/or sit out of the activity, and may only be permitted to return once the conduct violation(s) have been remedied. I understand that if I, my student(s), and/or my family continuously fail to comply with the code of conduct I, my student(s), and/or my family may be removed from any/all Limelight Performing Arts'' programs, courses, classes, workshops, rehearsals, performances, events, competitions, trips and/or all related activities, with no tuition proration or refunds granted.\n\n6. Applicable Law. Any legal or equitable claim that may arise from participation in the above shall be resolved under British Columbian law.\n\n7. No Duress. I agree and acknowledge that I am under no pressure or duress to sign this agreement and that I have been given a reasonable opportunity to review it before signing. I further agree and acknowledge that I am free to have my own legal counsel review this agreement if I so desire. I further agree and acknowledge that Limelight Performing Arts has offered to refund any fees I have paid to use its facilities if I choose not to sign this agreement.\n\n8. Arm''s Length Agreement. This agreement and each of its terms are the product of an arm''s length negotiation between the Parties. In the event any ambiguity is found to exist in the interpretation of this agreement or any of its provisions, the Parties, and each of them, explicitly reject the application of any legal or equitable rule of interpretation which would lead to a construction either "for" or "against" a particular party based upon their status as the drafter of a specific term, language, or provision giving rise to such ambiguity.\n\n9. Enforceability. The validity or enforceability of any provision of this agreement, whether standing alone or as applied to a particular occurrence or circumstance, shall not affect the validity or enforceability of any other provision of this agreement or of any other applications of such provision, as the case may be. Such invalid or unenforceable provision shall be deemed not to be a part of this agreement.\n\nI HAVE READ THIS DOCUMENT AND UNDERSTAND IT. I FURTHER UNDERSTAND THAT BY AGREEING TO THIS AGREEMENT, I VOLUNTARILY SURRENDER CERTAIN LEGAL RIGHTS.', true)
ON CONFLICT (title) DO NOTHING;

INSERT INTO waivers (title, description, content, required) VALUES
('Photo/Video Consent', 'Consent for Use of Images and Videos', E'I understand that participation in all Limelight Performing Arts'' programs, courses, classes, workshops, rehearsals, performances, events, competitions, trips and all related activities, and/or the use of the property, facilities, and services of Limelight Performing Arts, indicates my acceptance of all the below-listed Photo / Video Release terms and conditions.\n\nI agree for myself, my student(s), and (if applicable) for the members of my family, to the following:\n\n1. Release Of Likeness. I, hereby grant Limelight Performing Arts, and/or the related companies permission to use my, my student''s, and/or my family''s likeness in photographs and/or videos in any/all of its publications, including but not limited to all of Limelight''s printed and digital publications. I understand and agree that any photograph using my, my student''s, and/or my family''s likeness will become property of Limelight Performing Arts and will not be returned.\n\n2. Authorization To Alter. I hereby irrevocably authorize Limelight Performing Arts to edit, alter, copy, exhibit, publish or distribute this photo and/or video for purposes of publicizing Limelight Performing Arts'' programs, courses, classes, workshops, rehearsals, performances, events, competitions, trips and all related activities or for any other related, lawful purpose. In addition, I waive the right to inspect or approve the finished product, including printed and digital copies, wherein my, my student''s, and/or my family''s likeness appears.\n\n3. Fees. I acknowledge that since my, my student''s, and/or my family''s participation with Limelight Performing Arts'' programs, courses, classes, workshops, rehearsals, performances, events, competitions, trips and all related activities, and/or the use of the property, facilities, and services of Limelight Performing Arts is voluntary, I, my student(s), and/or my family will receive no financial compensation. Additionally, I waive any right to royalties or other compensation arising or related to the use of the photograph and/or video.\n\n4. Indemnification. I hereby hold harmless and release and forever discharge Limelight Performing Arts from all claims, demands, and causes of action which I, my student(s), my family, my heirs, representatives, executors, administrators, or any other persons acting on my behalf or on behalf of my estate have or may have by reason of this authorization.\n\n5. Applicable Law. Any legal or equitable claim that may arise from participation in the above shall be resolved under British Columbian law.\n\n6. No Duress. I agree and acknowledge that I am under no pressure or duress to sign this agreement and that I have been given a reasonable opportunity to review it before signing. I further agree and acknowledge that I am free to have my own legal counsel review this agreement if I so desire. I further agree and acknowledge that Limelight Performing Arts has offered to refund any fees I have paid to use its facilities if I choose not to sign this agreement.\n\n7. Arm''s Length Agreement. This agreement and each of its terms are the product of an arm''s length negotiation between the Parties. In the event any ambiguity is found to exist in the interpretation of this agreement or any of its provisions, the Parties, and each of them, explicitly reject the application of any legal or equitable rule of interpretation which would lead to a construction either "for" or "against" a particular party based upon their status as the drafter of a specific term, language, or provision giving rise to such ambiguity.\n\n8. Enforceability. The validity or enforceability of any provision of this agreement, whether standing alone or as applied to a particular occurrence or circumstance, shall not affect the validity or enforceability of any other provision of this agreement or of any other applications of such provision, as the case may be. Such invalid or unenforceable provision shall be deemed not to be a part of this agreement.\n\nI HAVE READ THIS DOCUMENT AND UNDERSTAND IT. I FURTHER UNDERSTAND THAT BY AGREEING TO THIS RELEASE, I VOLUNTARILY SURRENDER CERTAIN LEGAL RIGHTS.', true)
ON CONFLICT (title) DO NOTHING;

INSERT INTO waivers (title, description, content, required) VALUES
('Payment and Dress Code Agreement', 'Acknowledgement of Financial Obligations and Attire Requirements', E'--- PAYMENT POLICY ---\nI understand that participation in all Limelight Performing Arts'' programs, courses, classes, workshops, rehearsals, performances, events, competitions, trips and all related activities, and/or the use of the property, facilities, and services of Limelight Performing Arts, indicates my acceptance of all the below-listed Payment Policy terms and conditions.\n\nI agree for myself, my student(s), and (if applicable) for the members of my family, to the following:\n\n1. Commitment To Payment. I understand that participation in all Limelight Performing Arts'' programs, courses, classes, workshops, rehearsals, performances, events, competitions, trips and all related activities, and/or the use of the property, facilities, and services of Limelight Performing Arts, indicates my commitment to pay the full tuition and/or associated fees.\n\n2. When Payment Is Due. I understand that all year-long program tuition amounts are to be divided up into equal monthly payments. I understand all 9-week program tuition is to be divided into 2 equal payments. I understand all payments are to be made on or before the fifteenth (15th) of the month prior to service. I understand all camp, workshop, 1-day classes, and related program tuition must be paid in full upon enrollment.\n\n3. Forms Of Payment Accepted. I understand Limelight Performing Arts accepts online payments through the parent portal via Amex, Discover, Mastercard, and Visa.\n\n4. Discount Terms And Conditions. I understand Limelight Performing Arts offers a Year Multi-Class discount, discounting 2% on my third (3rd) class, 5% on my fifth (5th) class, and 7% on my tenth (10th) class and beyond. I understand Limelight Performing Arts offers a Yearly Multi-Student discount, discounting 5% of the second students'' tuition and 10% of the third, or any subsequent students'' tuitions from the same family household. I understand both these Yearly discounts may be stacked together. I understand Limelight Performing Arts offers a Summer Multi-Student discount, discounting $15.00 off each additional student''s camp enrollment. I understand these are the only discounts Limelight Performing Arts currently offers.\n\n5. Scholarship Terms And Conditions. I understand Limelight Performing Arts offers scholarships based on financial allowance and first come, first serve availability. I understand in order to be considered for a scholarship award I must submit a scholarship application with all the required documentation and/or supplements. I understand that my scholarship application submission does not guarantee a scholarship award. I understand Limelight Performing Arts offers a 30% scholarship for those with financial need and on a form of social assistance, awarding 30% of my first 3 classes. I understand Limelight Performing Arts offers a 15% scholarship to those with financial need, awarding 15% of my first 3 classes. I understand Limelight Performing Arts offers a 2:1 Youth Assistant scholarship to students 12+, awarding 1 free class for every 2 classes assisted. I understand Limelight Performing Arts offers a 10% Volunteer scholarship for families that commit 50+ volunteer hours over the year, awarding 10% of my first 3 classes. I understand that any misrepresentation of my, my student(s), or my families financial need or merit, is grounds for scholarship termination, in such case I will be solely responsible for returning all scholarship amounts awarded.\n\n6. Late Payments. I understand payments not received by the fifteenth (15th) of the month prior to service are considered late payments. I understand that all late payments have a grace period of three (3) days, after this a late fee of $25.00 will be charged to my account. I understand any overdue fees not received by the first (1st) of the month of service will result in student(s) being withdrawn from all Limelight Performing Arts'' programs, courses, classes, workshops, rehearsals, performances, events, competitions, trips and all related activities until full payment is received. I understand any/all late payment grace periods are intended solely for financial flexibility, I agree not to exploit this convenience.\n\n7. Absences. I understand if a student is absent for any/all personal reasons (sick, family trip, etc.) I will still be charged tuition for the day of absence. I understand Limelight Performing Arts does not offer refunds, or fee reimbursements for any student absences. I understand select Limelight Performing Arts programs, courses, and/or classes may be eligible for a ‘makeup class’. I understand all statutory holidays are not included in tuition fees, as Limelight Performing Arts is closed.\n\n8. Cancellations & Refunds. I understand I, my student(s), and/or my families enrollment in any Limelight Performing Arts program, course, class, workshop, rehearsal, performance, event, competition, and/or trip requires I pay the full tuition amount. I understand if I wish to cancel my, my student(s), and/or my families enrollment, I am still responsible for paying out the full tuition amount. I understand if I wish to cancel a Year-long class before the thirty-first (31st) of December, I may do so and only pay the first term''s (September-December) tuition. I understand all refunds may only be issued prior to two (2) months in advance from the first-day of class. I understand all payments may be transferred to another Limelight Performing Arts program, course, class, workshop, rehearsal, performance, event, competition, trip and/or related activity. I agree to contact the Limelight Performing Arts administration team if I am facing extraneous circumstances, and strongly believe a refund is required.\n\n9. Applicable Law. Any legal or equitable claim that may arise from participation in the above shall be resolved under British Columbian law.\n\n10. No Duress. I agree and acknowledge that I am under no pressure or duress to sign this agreement and that I have been given a reasonable opportunity to review it before signing. I further agree and acknowledge that I am free to have my own legal counsel review this agreement if I so desire. I further agree and acknowledge that Limelight Performing Arts has offered to refund any fees I have paid to use its facilities if I choose not to sign this agreement.\n\n11. Arm''s Length Agreement. This agreement and each of its terms are the product of an arm''s length negotiation between the Parties. In the event any ambiguity is found to exist in the interpretation of this agreement or any of its provisions, the Parties, and each of them, explicitly reject the application of any legal or equitable rule of interpretation which would lead to a construction either "for" or "against" a particular party based upon their status as the drafter of a specific term, language, or provision giving rise to such ambiguity.\n\n12. Enforceability. The validity or enforceability of any provision of this agreement, whether standing alone or as applied to a particular occurrence or circumstance, shall not affect the validity or enforceability of any other provision of this agreement or of any other applications of such provision, as the case may be. Such invalid or unenforceable provision shall be deemed not to be a part of this agreement.\n\n\n--- ATTIRE / DRESS CODE AGREEMENT ---\nI understand that participation in all Limelight Performing Arts'' programs, courses, classes, workshops, rehearsals, performances, events, competitions, trips and all related activities, and/or the use of the property, facilities, and services of Limelight Performing Arts, indicates my acceptance of all the below-listed Attire / Dress Code Agreement terms and conditions.\n\nI agree for myself, my student(s), and (if applicable) for the members of my family, to the following:\n\n1. Agreement To Follow Directions. I, my student(s), and/or family agree to follow Limelight Performing Arts guidelines to dress code and attire during all Limelight Performing Arts'' programs, courses, classes, workshops, rehearsals, performances, events, competitions, trips and all related activities, during use of the property, facilities, and services of Limelight Performing Arts, and/or when representing Limelight Performing Arts. I, my student(s), and/or family agree to observe and obey all posted rules and warnings, and further agree to follow any oral instructions or directions given by Limelight Performing Arts, or the related companies, associations, owners, managers, instructors, employees, representatives, volunteers, or agents of Limelight Performing Arts. I understand that each of Limelight Performing Arts'' programs, courses, classes, workshops, rehearsals, performances, events, competitions, trips and all related activities have unique attire guidelines, all of which can be found in the studio handbook on the Limelight Performing Arts website (limelightperformingarts.ca).\n\n2. Acceptable Attire. I understand acceptable attire depends on the program, course, class, workshop, rehearsal, performance, event, competition, trip and/or related activity''s designated dress code, and therefore acceptable attire may include; allocated uniforms; dance wear; athletic wear; fitted t-shirts and tank tops; fitted sweatpants; etc.. I understand dress codes include hair and makeup. I understand I, my students'', and/or my family''s hair must be kept up off the face (including bangs/fringe) at all times, and that hair styling must be done outside of class time. I understand that I, my students'', and/or my family''s makeup should be kept appropriate and should not disrupt class abilities. I understand that for certain programs, courses, classes, workshops, rehearsals, performances, events, competitions, trips and/or related activities I, my student(s), and/or my family may be required to style their hair and or makeup in a specific way dictated by Limelight Performing Arts. I understand I, my students'', and/or my family''s personal grooming must be kept clean, tidy, and within societal expectations, (wearing deodorant, and showering regularly is expected).\n\n3. Unacceptable Attire. I understand unacceptable attire depends on the program, course, class, workshop, rehearsal, performance, event, competition, trip and/or related activity''s designated dress code, and therefore unacceptable attire may include; jeans; ''baggy'' shirts; ''baggy'' sweatshirts; ''baggy'' sweatpants/pants; jewelry; outdoor shoes; etc.. I understand dress codes include hair and makeup. I understand I, my students'', and/or my family''s hair must not be ''down'' or ''messy''. I understand that I, my students'', and/or my family''s makeup must not be inappropriate or too excessive as to effect class abilities. I understand I, my students'', and/or my family''s personal grooming must not be ''unkept''.\n\n4. Enforcement. I understand dress codes will be enforced for all Limelight Performing Arts'' programs, courses, classes, workshops, rehearsals, performances, events, competitions, trips and all related activities, as well as during the use of the property, facilities, and services of Limelight Performing Arts, and/or when representing Limelight Performing Arts. I understand dress codes will be communicated to me, my student(s), and my family through; the studio handbook; the parent portal; email communications; and verbally by instructors. I understand that if I, my student(s), and/or my family fail to comply with the dress code, a maximum of two (2) warnings will be given, the first will be a verbal instructor warning, the second will be a written administration warning.\n\n5. Disciplinary Action. I understand that if I, my student(s), and/or my family fail to comply with the dress code beyond the permitted two (2) warnings, I, my student(s), and/or my family may be asked to leave and/or sit out of the activity, and may only be permitted to return once the dress code violation(s) have been remedied. I understand that if I, my student(s), and/or my family continuously fail to comply with the dress code I, my student(s), and/or my family may be removed from any/all Limelight Performing Arts'' programs, courses, classes, workshops, rehearsals, performances, events, competitions, trips and/or all related activities, with no tuition proration or refunds granted.\n\n6. Applicable Law. Any legal or equitable claim that may arise from participation in the above shall be resolved under British Columbian law.\n\n7. No Duress. I agree and acknowledge that I am under no pressure or duress to sign this agreement and that I have been given a reasonable opportunity to review it before signing. I further agree and acknowledge that I am free to have my own legal counsel review this agreement if I so desire. I further agree and acknowledge that Limelight Performing Arts has offered to refund any fees I have paid to use its facilities if I choose not to sign this agreement.\n\n8. Arm''s Length Agreement. This agreement and each of its terms are the product of an arm''s length negotiation between the Parties. In the event any ambiguity is found to exist in the interpretation of this agreement or any of its provisions, the Parties, and each of them, explicitly reject the application of any legal or equitable rule of interpretation which would lead to a construction either "for" or "against" a particular party based upon their status as the drafter of a specific term, language, or provision giving rise to such ambiguity.\n\n9. Enforceability. The validity or enforceability of any provision of this agreement, whether standing alone or as applied to a particular occurrence or circumstance, shall not affect the validity or enforceability of any other provision of this agreement or of any other applications of such provision, as the case may be. Such invalid or unenforceable provision shall be deemed not to be a part of this agreement.\n\n\nI HAVE READ THIS DOCUMENT AND UNDERSTAND IT. I FURTHER UNDERSTAND THAT BY AGREEING TO THIS POLICY/AGREEMENT, I VOLUNTARILY SURRENDER CERTAIN LEGAL RIGHTS.', true)
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
