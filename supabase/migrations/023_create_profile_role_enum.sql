-- Migration: enforce profile roles via enum and add audit metadata

-- Create enum for profile roles if it doesn't already exist
DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_type t
            WHERE t.typname = 'profile_role'
        ) THEN
            CREATE TYPE profile_role AS ENUM ('user', 'instructor', 'admin');
        END IF;
    END
$$;

-- Normalize existing data before altering the column
UPDATE profiles
SET role = 'user'
WHERE role IS NULL OR trim(role) = '' OR role NOT IN ('user', 'instructor', 'admin');

-- Drop policies that reference profiles.role so we can alter the type safely
DROP POLICY IF EXISTS "Allow admins to manage products" ON public.products;
DROP POLICY IF EXISTS "Allow admins to manage product variants" ON public.product_variants;
DROP POLICY IF EXISTS "Allow admins to manage orders" ON public.orders;
DROP POLICY IF EXISTS "Allow admins to manage order items" ON public.order_items;
DROP POLICY IF EXISTS "Allow admins to manage tax rates" ON public.tax_rates;
DROP POLICY IF EXISTS "Allow admins to manage payment taxes" ON public.payment_taxes;
DROP POLICY IF EXISTS "Profiles viewable by user, admin, or instructor" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all families" ON public.families;
DROP POLICY IF EXISTS "Admins can manage all families" ON public.families;
DROP POLICY IF EXISTS "Admins can manage all attendance" ON public.attendance;
DROP POLICY IF EXISTS "Allow admins to manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "Instructors can manage attendance for their sessions" ON public.attendance;
DROP POLICY IF EXISTS "Admins can manage waiver signatures" ON public.waiver_signatures;
DROP POLICY IF EXISTS "Allow admins to manage all sessions" ON public.one_on_one_sessions;
DROP POLICY IF EXISTS "Allow admins to manage session usage" ON public.one_on_one_session_usage;
DROP POLICY IF EXISTS "Allow participants to view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow users to view their own participation" ON public.conversation_participants;
DROP POLICY IF EXISTS "Allow admins to insert participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Allow participants to view messages" ON public.messages;
DROP POLICY IF EXISTS "Allow admins to delete messages" ON public.messages;
DROP POLICY IF EXISTS "Allow admins to manage discount codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Allow admins to view all discount usage" ON public.discount_code_usage;
DROP POLICY IF EXISTS "Allow admins to manage discount templates" ON public.discount_templates;
DROP POLICY IF EXISTS "Allow admins to manage discount events" ON public.discount_events;
DROP POLICY IF EXISTS "Allow admins to manage automation rules" ON public.discount_automation_rules;
DROP POLICY IF EXISTS "Allow admins to manage automation rule discount templates" ON public.automation_rule_discount_templates;
DROP POLICY IF EXISTS "Allow admins to manage automation rule templates" ON public.automation_rule_discount_templates;
DROP POLICY IF EXISTS "Allow admins to manage discount assignments" ON public.discount_assignments;
DROP POLICY IF EXISTS "Allow admins to manage programs" ON public.programs;
DROP POLICY IF EXISTS "Allow admins to manage classes" ON public.classes;
DROP POLICY IF EXISTS "Allow admins to manage class schedules" ON public.class_schedules;
DROP POLICY IF EXISTS "Allow admins to manage class sessions" ON public.class_sessions;
DROP POLICY IF EXISTS "Allow admins to manage enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Allow admins to manage push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Admin can manage all events" ON public.events;
DROP POLICY IF EXISTS "Instructors can view and manage their events" ON public.events;
DROP POLICY IF EXISTS "Admin can manage all event registrations" ON public.event_registrations;
DROP POLICY IF EXISTS "Admin can manage event waivers" ON public.event_waivers;
DROP POLICY IF EXISTS "Users can view invoice line item taxes for accessible invoices" ON public.invoice_line_item_taxes;
DROP POLICY IF EXISTS "Admins can manage invoice line item taxes" ON public.invoice_line_item_taxes;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT p.polname AS policyname,
               n.nspname AS schemaname,
               c.relname AS tablename,
               pg_get_expr(p.polqual, p.polrelid) AS using_clause,
               pg_get_expr(p.polwithcheck, p.polrelid) AS check_clause
        FROM pg_policy p
        JOIN pg_class c ON c.oid = p.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
    LOOP
        IF (COALESCE(pol.using_clause, '') LIKE '%profiles.role%'
            OR COALESCE(pol.check_clause, '') LIKE '%profiles.role%') THEN
            EXECUTE format('DROP POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
        END IF;
    END LOOP;
END $$;

-- Final sweep: drop any remaining policies whose definition still references profiles.role

-- Drop any existing default before switching the type
ALTER TABLE profiles
    ALTER COLUMN role DROP DEFAULT;

-- Alter the column to use the enum and enforce defaults
ALTER TABLE profiles ADD COLUMN role_tmp text;

UPDATE profiles
SET role_tmp = COALESCE(NULLIF(trim(role::text), ''), 'user');

ALTER TABLE profiles
    ALTER COLUMN role_tmp TYPE profile_role
        USING role_tmp::profile_role;

ALTER TABLE profiles DROP COLUMN role;
ALTER TABLE profiles RENAME COLUMN role_tmp TO role;

ALTER TABLE profiles
    ALTER COLUMN role SET DEFAULT 'user'::profile_role,
    ALTER COLUMN role SET NOT NULL;

COMMENT ON TYPE profile_role IS 'Application access levels: user (family/guardian), instructor, admin';
COMMENT ON COLUMN profiles.role IS 'Access role constrained by profile_role enum';

-- Recreate policies that depend on profiles.role now that the enum is in place
CREATE POLICY "Admin can manage all event registrations" ON public.event_registrations
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.role = 'admin'::profile_role
                )
            );

CREATE POLICY "Admin can manage all events" ON public.events
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.role = 'admin'::profile_role
                )
            );

CREATE POLICY "Admin can manage event waivers" ON public.event_waivers
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.role = 'admin'::profile_role
                )
            );

CREATE POLICY "Admins can manage all attendance" ON public.attendance
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1
                   FROM profiles
                   WHERE profiles.id = auth.uid()
                     AND profiles.role = 'admin'::profile_role))
    WITH CHECK (EXISTS (SELECT 1
                        FROM profiles
                        WHERE profiles.id = auth.uid()
                          AND profiles.role = 'admin'::profile_role));

CREATE POLICY "Allow admins to manage attendance" ON public.attendance
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'::profile_role
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'::profile_role
        )
    );

CREATE POLICY "Admins can manage all families" ON public.families
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

CREATE POLICY "Admins can manage waiver signatures" ON public.waiver_signatures
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1
                   FROM profiles
                   WHERE profiles.id = auth.uid()
                     AND profiles.role = 'admin'::profile_role));

CREATE POLICY "Admins can view all families" ON public.families
    FOR SELECT USING (
    EXISTS (SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'::profile_role)
    );

CREATE POLICY "Allow admins to delete messages" ON public.messages
    FOR DELETE USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );

CREATE POLICY "Allow admins to insert participants" ON public.conversation_participants
    FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );

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

CREATE POLICY "Allow admins to manage automation rule templates" ON public.automation_rule_discount_templates
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

CREATE POLICY "Allow admins to manage order items" ON public.order_items
                FOR ALL USING (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
                ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
                );

CREATE POLICY "Allow admins to manage orders" ON public.orders
                FOR ALL USING (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
                ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
                );

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

CREATE POLICY "Allow admins to manage products" ON public.products
                FOR ALL USING (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
                ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
                );

CREATE POLICY "Allow admins to manage product variants" ON public.product_variants
                FOR ALL USING (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
                ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
                );

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

CREATE POLICY "Users can view invoice line item taxes for accessible invoices" ON public.invoice_line_item_taxes
            FOR SELECT USING (
                invoice_line_item_id IN (
                    SELECT id FROM invoice_line_items WHERE 
                        invoice_id IN (
                            SELECT id FROM invoices WHERE 
                                family_id IN (
                                    SELECT family_id FROM profiles WHERE id = auth.uid()
                                ) OR auth.role() = 'service_role'
                        )
                )
            );

CREATE POLICY "Admins can manage invoice line item taxes" ON public.invoice_line_item_taxes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'::profile_role
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'::profile_role
        )
    );

CREATE POLICY "Allow admins to manage push subscriptions" ON public.push_subscriptions
            FOR ALL USING (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
            ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'::profile_role)
            );

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

CREATE POLICY "Allow admins to view all discount usage" ON public.discount_code_usage
    FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role = 'admin'::profile_role)
    );

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

CREATE POLICY "Instructors can manage attendance for their sessions" ON public.attendance
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1
                   FROM profiles
                            JOIN class_sessions cs ON cs.instructor_id = profiles.id
                   WHERE profiles.id = auth.uid()
                     AND profiles.role = 'instructor'::profile_role
                     AND cs.id = attendance.class_session_id))
    WITH CHECK (EXISTS (SELECT 1
                        FROM profiles
                                 JOIN class_sessions cs ON cs.instructor_id = profiles.id
                        WHERE profiles.id = auth.uid()
                          AND profiles.role = 'instructor'::profile_role
                          AND cs.id = attendance.class_session_id));

CREATE POLICY "Instructors can view and manage their events" ON public.events
            FOR ALL USING (
                instructor_id = auth.uid() OR
                created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE profiles.id = auth.uid() 
                    AND profiles.role IN ('admin'::profile_role, 'instructor'::profile_role)
                )
            );

CREATE POLICY "Profiles viewable by user, admin, or instructor" ON public.profiles
    FOR SELECT USING (
    auth.uid() = id -- Can view own profile
        OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin'::profile_role, 'instructor'::profile_role)) -- Admins and instructors can view all profiles
    );
