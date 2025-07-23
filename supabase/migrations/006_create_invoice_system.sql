-- Invoice System Migration
-- Phase 1: Database Foundation

-- Create invoice_entities table
CREATE TABLE invoice_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    entity_type VARCHAR NOT NULL CHECK (entity_type IN ('family', 'school', 'government', 'corporate', 'other')),
    contact_person VARCHAR,
    email VARCHAR,
    phone VARCHAR,
    address_line1 VARCHAR,
    address_line2 VARCHAR,
    city VARCHAR,
    state VARCHAR,
    postal_code VARCHAR,
    country VARCHAR DEFAULT 'US',
    tax_id VARCHAR,
    payment_terms VARCHAR DEFAULT 'Net 30' CHECK (payment_terms IN ('Due on Receipt', 'Net 15', 'Net 30', 'Net 60', 'Net 90')),
    credit_limit DECIMAL(10,2),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add invoice_status enum
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'viewed', 'paid', 'partially_paid', 'overdue', 'cancelled');

-- Add invoice_payment_method enum  
CREATE TYPE invoice_payment_method AS ENUM ('cash', 'check', 'bank_transfer', 'credit_card', 'ach', 'other');

-- Add invoice_item_type enum
CREATE TYPE invoice_item_type AS ENUM ('class_enrollment', 'individual_session', 'product', 'fee', 'discount', 'other');

-- Create invoices table
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR UNIQUE NOT NULL,
    entity_id UUID NOT NULL REFERENCES invoice_entities(id),
    family_id UUID REFERENCES families(id),
    status invoice_status DEFAULT 'draft',
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    service_period_start DATE,
    service_period_end DATE,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
    amount_due DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    notes TEXT,
    terms TEXT,
    footer_text TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    viewed_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoice_line_items table
CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_type invoice_item_type NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(10,2) NOT NULL,
    tax_rate DECIMAL(5,4) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    discount_rate DECIMAL(5,4) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    enrollment_id UUID REFERENCES enrollments(id),
    product_id UUID,
    service_period_start DATE,
    service_period_end DATE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoice_payments table
CREATE TABLE invoice_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    payment_method invoice_payment_method NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    reference_number VARCHAR,
    notes TEXT,
    stripe_payment_intent_id VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoice_status_history table
CREATE TABLE invoice_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    old_status invoice_status,
    new_status invoice_status NOT NULL,
    changed_by UUID,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_invoice_entities_entity_type ON invoice_entities(entity_type);
CREATE INDEX idx_invoice_entities_is_active ON invoice_entities(is_active);
CREATE INDEX idx_invoices_entity_id ON invoices(entity_id);
CREATE INDEX idx_invoices_family_id ON invoices(family_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_enrollment_id ON invoice_line_items(enrollment_id);
CREATE INDEX idx_invoice_payments_invoice_id ON invoice_payments(invoice_id);
CREATE INDEX idx_invoice_payments_payment_date ON invoice_payments(payment_date);
CREATE INDEX idx_invoice_status_history_invoice_id ON invoice_status_history(invoice_id);

-- Create function for generating invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR AS $$
DECLARE
    current_year VARCHAR(4);
    next_number INTEGER;
    invoice_number VARCHAR;
BEGIN
    current_year := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
    
    -- Get the next sequential number for this year
    SELECT COALESCE(MAX(
        CASE 
            WHEN invoice_number ~ ('^INV-' || current_year || '-[0-9]+$')
            THEN CAST(SUBSTRING(invoice_number FROM LENGTH('INV-' || current_year || '-') + 1) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO next_number
    FROM invoices;
    
    -- Format: INV-YYYY-NNNN (e.g., INV-2025-0001)
    invoice_number := 'INV-' || current_year || '-' || LPAD(next_number::VARCHAR, 4, '0');
    
    RETURN invoice_number;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate invoice numbers
CREATE OR REPLACE FUNCTION set_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
        NEW.invoice_number := generate_invoice_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_invoice_number
    BEFORE INSERT ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION set_invoice_number();

-- Create trigger to update invoice totals when line items change
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
    invoice_subtotal DECIMAL(10,2);
    invoice_tax_amount DECIMAL(10,2);
    invoice_discount_amount DECIMAL(10,2);
    invoice_total DECIMAL(10,2);
    invoice_amount_paid DECIMAL(10,2);
BEGIN
    -- Calculate totals from line items
    SELECT 
        COALESCE(SUM(line_total), 0),
        COALESCE(SUM(tax_amount), 0),
        COALESCE(SUM(discount_amount), 0)
    INTO invoice_subtotal, invoice_tax_amount, invoice_discount_amount
    FROM invoice_line_items 
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Calculate total amount
    invoice_total := invoice_subtotal + invoice_tax_amount - invoice_discount_amount;
    
    -- Get amount paid
    SELECT COALESCE(SUM(amount), 0)
    INTO invoice_amount_paid
    FROM invoice_payments
    WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    -- Update invoice totals
    UPDATE invoices SET
        subtotal = invoice_subtotal,
        tax_amount = invoice_tax_amount,
        discount_amount = invoice_discount_amount,
        total_amount = invoice_total,
        amount_paid = invoice_amount_paid,
        amount_due = invoice_total - invoice_amount_paid,
        updated_at = NOW()
    WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_totals_on_line_items
    AFTER INSERT OR UPDATE OR DELETE ON invoice_line_items
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_totals();

CREATE TRIGGER trigger_update_invoice_totals_on_payments
    AFTER INSERT OR UPDATE OR DELETE ON invoice_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_totals();

-- Create trigger to track status changes
CREATE OR REPLACE FUNCTION track_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO invoice_status_history (invoice_id, old_status, new_status, notes)
        VALUES (NEW.id, OLD.status, NEW.status, 'Status changed automatically');
        
        -- Update timestamp fields based on status
        IF NEW.status = 'sent' AND OLD.status = 'draft' THEN
            NEW.sent_at := NOW();
        ELSIF NEW.status = 'viewed' AND NEW.viewed_at IS NULL THEN
            NEW.viewed_at := NOW();
        ELSIF NEW.status = 'paid' THEN
            NEW.paid_at := NOW();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_track_invoice_status_change
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION track_invoice_status_change();

-- Create updated_at trigger for invoices
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_invoice_entities_updated_at
    BEFORE UPDATE ON invoice_entities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_invoice_payments_updated_at
    BEFORE UPDATE ON invoice_payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add RLS (Row Level Security) policies
ALTER TABLE invoice_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoice_entities
CREATE POLICY "Users can view all invoice entities" ON invoice_entities
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert invoice entities" ON invoice_entities
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update invoice entities" ON invoice_entities
    FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS Policies for invoices
CREATE POLICY "Users can view invoices for their families" ON invoices
    FOR SELECT USING (
        family_id IN (
            SELECT family_id FROM profiles WHERE id = auth.uid()
        ) OR auth.role() = 'service_role'
    );

CREATE POLICY "Authenticated users can insert invoices" ON invoices
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update invoices" ON invoices
    FOR UPDATE USING (auth.role() = 'authenticated');

-- RLS Policies for invoice_line_items
CREATE POLICY "Users can view line items for accessible invoices" ON invoice_line_items
    FOR SELECT USING (
        invoice_id IN (
            SELECT id FROM invoices WHERE 
                family_id IN (
                    SELECT family_id FROM profiles WHERE id = auth.uid()
                ) OR auth.role() = 'service_role'
        )
    );

CREATE POLICY "Authenticated users can manage line items" ON invoice_line_items
    FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for invoice_payments
CREATE POLICY "Users can view payments for accessible invoices" ON invoice_payments
    FOR SELECT USING (
        invoice_id IN (
            SELECT id FROM invoices WHERE 
                family_id IN (
                    SELECT family_id FROM profiles WHERE id = auth.uid()
                ) OR auth.role() = 'service_role'
        )
    );

CREATE POLICY "Authenticated users can manage payments" ON invoice_payments
    FOR ALL USING (auth.role() = 'authenticated');

-- RLS Policies for invoice_status_history
CREATE POLICY "Users can view status history for accessible invoices" ON invoice_status_history
    FOR SELECT USING (
        invoice_id IN (
            SELECT id FROM invoices WHERE 
                family_id IN (
                    SELECT family_id FROM profiles WHERE id = auth.uid()
                ) OR auth.role() = 'service_role'
        )
    );

CREATE POLICY "Authenticated users can manage status history" ON invoice_status_history
    FOR ALL USING (auth.role() = 'authenticated');

-- Create default invoice entity for the school
INSERT INTO invoice_entities (
    name,
    entity_type,
    contact_person,
    email,
    phone,
    address_line1,
    city,
    state,
    postal_code,
    country,
    payment_terms,
    is_active,
    notes
) VALUES (
    'Karate School',
    'school',
    'School Administrator',
    'admin@karateschool.com',
    '(555) 123-4567',
    '123 Martial Arts Way',
    'Anytown',
    'CA',
    '12345',
    'US',
    'Net 30',
    true,
    'Default school entity for invoice generation'
);