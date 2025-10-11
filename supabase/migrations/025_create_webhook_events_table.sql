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
