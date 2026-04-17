-- Add columns required by curriculum and adult self-registration features
-- that were referenced in migration 042 but not yet created.

DO $$ BEGIN
  CREATE TYPE public.audience_scope AS ENUM ('youth', 'adults', 'mixed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.engagement_type AS ENUM ('program', 'seminar');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS audience_scope public.audience_scope NOT NULL DEFAULT 'youth';

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS engagement_type public.engagement_type NOT NULL DEFAULT 'program';

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS allow_self_enrollment boolean NOT NULL DEFAULT false;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS allow_self_participants boolean NOT NULL DEFAULT false;

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS participant_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Additional missing columns discovered via schema audit

DO $$ BEGIN
  CREATE TYPE public.ability_category AS ENUM ('able', 'adaptive');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.delivery_format AS ENUM ('group', 'private', 'competition_individual', 'competition_team', 'introductory');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.family_type AS ENUM ('household', 'self', 'organization');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.seminar_type AS ENUM ('introductory', 'intermediate', 'advanced');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.series_status AS ENUM ('tentative', 'confirmed', 'cancelled', 'in_progress', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.registration_status AS ENUM ('open', 'closed', 'waitlisted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- class_sessions
ALTER TABLE public.class_sessions
  ADD COLUMN IF NOT EXISTS sequence_number integer NULL;

-- classes
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS min_capacity integer NULL,
  ADD COLUMN IF NOT EXISTS on_demand boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price_override_cents integer NULL,
  ADD COLUMN IF NOT EXISTS registration_fee_override_cents integer NULL,
  ADD COLUMN IF NOT EXISTS registration_status public.registration_status NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS series_end_on date NULL,
  ADD COLUMN IF NOT EXISTS series_label text NULL,
  ADD COLUMN IF NOT EXISTS series_session_quota integer NULL,
  ADD COLUMN IF NOT EXISTS series_start_on date NULL,
  ADD COLUMN IF NOT EXISTS series_status public.series_status NOT NULL DEFAULT 'tentative',
  ADD COLUMN IF NOT EXISTS session_duration_minutes integer NULL,
  ADD COLUMN IF NOT EXISTS sessions_per_week_override integer NULL,
  ADD COLUMN IF NOT EXISTS topic text NULL;

-- families
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS family_type public.family_type NOT NULL DEFAULT 'household';

-- invoice_line_items
ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS tax_amount_cents integer NOT NULL DEFAULT 0;

-- payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text NULL;

-- programs
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS ability_category public.ability_category NULL,
  ADD COLUMN IF NOT EXISTS delivery_format public.delivery_format NULL,
  ADD COLUMN IF NOT EXISTS min_capacity integer NULL,
  ADD COLUMN IF NOT EXISTS seminar_type public.seminar_type NULL,
  ADD COLUMN IF NOT EXISTS single_purchase_price_cents integer NULL,
  ADD COLUMN IF NOT EXISTS slug text NULL,
  ADD COLUMN IF NOT EXISTS subscription_monthly_price_cents integer NULL,
  ADD COLUMN IF NOT EXISTS subscription_yearly_price_cents integer NULL;

-- students
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS is_adult boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
