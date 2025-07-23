-- Invoice Templates Migration
-- Creates tables for storing invoice templates in the database

-- Create invoice_templates table
CREATE TABLE IF NOT EXISTS invoice_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    description TEXT,
    category VARCHAR NOT NULL CHECK (category IN ('enrollment', 'fees', 'products', 'custom')),
    is_active BOOLEAN DEFAULT true,
    is_system_template BOOLEAN DEFAULT false, -- For built-in vs custom templates
    created_by UUID REFERENCES profiles(id),
    default_terms TEXT,
    default_notes TEXT,
    default_footer TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoice_template_line_items table
CREATE TABLE IF NOT EXISTS invoice_template_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES invoice_templates(id) ON DELETE CASCADE,
    item_type invoice_item_type NOT NULL,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_price DECIMAL(10,2) DEFAULT 0,
    tax_rate DECIMAL(6,4) DEFAULT 0,
    discount_rate DECIMAL(6,4) DEFAULT 0,
    service_period_start DATE,
    service_period_end DATE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_templates_category ON invoice_templates(category);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_is_active ON invoice_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_invoice_templates_is_system ON invoice_templates(is_system_template);
CREATE INDEX IF NOT EXISTS idx_invoice_template_line_items_template_id ON invoice_template_line_items(template_id);
CREATE INDEX IF NOT EXISTS idx_invoice_template_line_items_sort_order ON invoice_template_line_items(sort_order);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_invoice_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_invoice_template_updated_at
    BEFORE UPDATE ON invoice_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_template_updated_at();

-- Insert system templates (migrated from static data)
INSERT INTO invoice_templates (id, name, description, category, is_system_template, default_terms, default_notes) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Monthly Class Enrollment', 'Standard monthly enrollment fee for regular classes', 'enrollment', true, 'Payment is due by the 1st of each month. Late fees may apply after the 5th.', 'Thank you for your continued participation in our martial arts program.'),
('550e8400-e29b-41d4-a716-446655440002', 'New Student Registration', 'Complete package for new student registration including fees and equipment', 'enrollment', true, 'Registration fee is non-refundable. Monthly fees are due by the 1st of each month.', 'Welcome to our martial arts family! We look forward to your training journey.'),
('550e8400-e29b-41d4-a716-446655440003', 'Belt Testing Fees', 'Fees for belt promotion testing', 'fees', true, 'Testing fees are due before the testing date.', 'Congratulations on your progress! Good luck with your testing.'),
('550e8400-e29b-41d4-a716-446655440004', 'Tournament Registration', 'Registration fees for tournament participation', 'fees', true, 'Tournament fees are non-refundable and must be paid before the registration deadline.', 'We wish you the best of luck in the tournament!'),
('550e8400-e29b-41d4-a716-446655440005', 'Sparring Equipment Package', 'Complete sparring gear package for competition students', 'products', true, 'Equipment sales are final. Please ensure proper fit before purchase.', 'This equipment meets tournament standards and regulations.'),
('550e8400-e29b-41d4-a716-446655440006', 'Private Lesson Package', 'Package of private one-on-one lessons', 'enrollment', true, 'Private lessons must be scheduled in advance and are subject to instructor availability.', 'Private lessons provide personalized instruction to accelerate your progress.'),
('550e8400-e29b-41d4-a716-446655440007', 'Family Enrollment with Discount', 'Multiple family members with family discount applied', 'enrollment', true, 'Family discount applies to additional family members. Payment is due by the 1st of each month.', 'Thank you for bringing your family to train with us!'),
('550e8400-e29b-41d4-a716-446655440008', 'Makeup Class Fees', 'Fees for makeup classes due to absences', 'fees', true, 'Makeup classes must be scheduled within 30 days of the missed class.', 'Makeup classes help ensure you stay on track with your training.'),
('550e8400-e29b-41d4-a716-446655440009', 'Summer Camp Program', 'Week-long summer martial arts camp', 'enrollment', true, 'Camp fees are due one week before the camp start date. Cancellations must be made 48 hours in advance.', 'Our summer camp provides intensive training and fun activities for all skill levels.'),
('550e8400-e29b-41d4-a716-446655440010', 'Annual Membership Discount', 'Full year membership with discount for upfront payment', 'enrollment', true, 'Annual membership is non-refundable but transferable. Membership includes all regular classes.', 'Thank you for your commitment to training with us for the full year!');

-- Insert template line items
INSERT INTO invoice_template_line_items (template_id, item_type, description, quantity, unit_price, tax_rate, discount_rate, sort_order) VALUES
-- Monthly enrollment
('550e8400-e29b-41d4-a716-446655440001', 'class_enrollment', 'Monthly Class Fee', 1, 0, 0, 0, 0),

-- Registration package
('550e8400-e29b-41d4-a716-446655440002', 'fee', 'Registration Fee', 1, 50, 0, 0, 0),
('550e8400-e29b-41d4-a716-446655440002', 'fee', 'Uniform (Gi)', 1, 75, 0, 0, 1),
('550e8400-e29b-41d4-a716-446655440002', 'fee', 'Belt', 1, 15, 0, 0, 2),
('550e8400-e29b-41d4-a716-446655440002', 'class_enrollment', 'First Month Class Fee', 1, 0, 0, 0, 3),

-- Testing fees
('550e8400-e29b-41d4-a716-446655440003', 'fee', 'Belt Testing Fee', 1, 40, 0, 0, 0),
('550e8400-e29b-41d4-a716-446655440003', 'fee', 'New Belt', 1, 20, 0, 0, 1),

-- Tournament fees
('550e8400-e29b-41d4-a716-446655440004', 'fee', 'Tournament Entry Fee', 1, 60, 0, 0, 0),
('550e8400-e29b-41d4-a716-446655440004', 'fee', 'USANKF Membership (if required)', 1, 35, 0, 0, 1),

-- Equipment package
('550e8400-e29b-41d4-a716-446655440005', 'fee', 'Sparring Gloves', 1, 45, 0, 0, 0),
('550e8400-e29b-41d4-a716-446655440005', 'fee', 'Foot Pads', 1, 35, 0, 0, 1),
('550e8400-e29b-41d4-a716-446655440005', 'fee', 'Shin Guards', 1, 40, 0, 0, 2),
('550e8400-e29b-41d4-a716-446655440005', 'fee', 'Headgear', 1, 65, 0, 0, 3),
('550e8400-e29b-41d4-a716-446655440005', 'fee', 'Mouthguard', 1, 15, 0, 0, 4),

-- Private lessons
('550e8400-e29b-41d4-a716-446655440006', 'individual_session', 'Private Lesson (1 hour)', 4, 75, 0, 0, 0),

-- Family discount
('550e8400-e29b-41d4-a716-446655440007', 'class_enrollment', 'First Family Member - Monthly Fee', 1, 0, 0, 0, 0),
('550e8400-e29b-41d4-a716-446655440007', 'class_enrollment', 'Additional Family Member - Monthly Fee', 1, 0, 0, 0.10, 1),

-- Makeup classes
('550e8400-e29b-41d4-a716-446655440008', 'fee', 'Makeup Class Fee', 1, 25, 0, 0, 0),

-- Summer camp
('550e8400-e29b-41d4-a716-446655440009', 'fee', 'Summer Camp Week 1', 1, 150, 0, 0, 0),
('550e8400-e29b-41d4-a716-446655440009', 'fee', 'Camp T-Shirt', 1, 20, 0, 0, 1),
('550e8400-e29b-41d4-a716-446655440009', 'fee', 'Lunch (5 days)', 1, 50, 0, 0, 2),

-- Annual membership
('550e8400-e29b-41d4-a716-446655440010', 'class_enrollment', 'Annual Membership (12 months)', 12, 0, 0, 0.15, 0);