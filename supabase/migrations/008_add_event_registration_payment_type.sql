-- Add event_registration to payment_type_enum
ALTER TYPE public.payment_type_enum ADD VALUE IF NOT EXISTS 'event_registration';