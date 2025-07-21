-- Add push notifications support
-- This migration creates the push_subscriptions table for storing web push notification subscriptions

-- Create push_subscriptions table
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
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
            ) WITH CHECK (
                EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
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