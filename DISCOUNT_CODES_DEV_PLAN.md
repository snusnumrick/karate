# Discount Codes Development Plan

## Overview
Implement a comprehensive discount code system for the karate application that allows both automatic and manual discount code creation, with flexible applicability rules and usage restrictions.

## Database Schema

### 1. Discount Codes Table
```sql
CREATE TABLE discount_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    
    -- Discount Type
    discount_type text NOT NULL CHECK (discount_type IN ('fixed_amount', 'percentage')),
    discount_value numeric(10,2) NOT NULL CHECK (discount_value > 0),
    
    -- Usage Restrictions
    usage_type text NOT NULL CHECK (usage_type IN ('one_time', 'ongoing')),
    max_uses integer NULL, -- NULL = unlimited
    current_uses integer NOT NULL DEFAULT 0,
    
    -- Applicability
    applicable_to text NOT NULL CHECK (applicable_to IN ('training', 'store', 'both')),
    scope text NOT NULL CHECK (scope IN ('per_student', 'per_family')),
    
    -- Validity
    is_active boolean NOT NULL DEFAULT true,
    valid_from timestamptz NOT NULL DEFAULT now(),
    valid_until timestamptz NULL,
    
    -- Creation tracking
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_automatically boolean NOT NULL DEFAULT false,
    
    -- Timestamps
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 2. Discount Code Usage Table
```sql
CREATE TABLE discount_code_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    discount_code_id uuid NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
    payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    family_id uuid NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    student_id uuid NULL REFERENCES students(id) ON DELETE CASCADE, -- NULL for family-wide discounts
    
    -- Applied discount details (snapshot)
    discount_amount integer NOT NULL CHECK (discount_amount >= 0), -- in cents
    original_amount integer NOT NULL CHECK (original_amount >= 0), -- in cents
    final_amount integer NOT NULL CHECK (final_amount >= 0), -- in cents
    
    used_at timestamptz NOT NULL DEFAULT now()
);
```

### 3. Update Payments Table
```sql
ALTER TABLE payments ADD COLUMN discount_code_id uuid NULL REFERENCES discount_codes(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN discount_amount integer NULL CHECK (discount_amount >= 0); -- in cents
```

## Implementation Steps

### Phase 1: Database Schema
1. ✅ Create discount_codes table
2. ✅ Create discount_code_usage table  
3. ✅ Update payments table with discount fields
4. ✅ Add RLS policies
5. ✅ Add indexes for performance

### Phase 2: Backend Services ✅ COMPLETED
1. ✅ Create discount code validation service (`app/services/discount.server.ts`)
2. ✅ Update payment creation logic to handle discounts
3. ✅ Create discount code management functions
4. ✅ Update payment completion to record usage

### Phase 3: Admin UI ✅ COMPLETED
1. ✅ Admin discount codes list page (`/admin/discount-codes`)
2. ✅ Create discount code form (`/admin/discount-codes/new`)
3. ✅ Edit/deactivate discount codes
4. ✅ View usage statistics

### Phase 4: User UI ✅ COMPLETED
1. ✅ Add discount code selection to payment page (`DiscountCodeSelector` component)
2. ✅ Real-time discount calculation
3. ✅ Display applied discounts in payment summary
4. ✅ Update payment success page to show discount details

### Phase 5: Automatic Discount Generation
1. Create service for automatic discount generation
2. Integration points for triggering automatic discounts
3. Configuration for automatic discount rules

## Implementation Details

### Completed Features

#### Backend Services
- **Discount Service** (`app/services/discount.server.ts`)
  - `validateDiscountCode()` - Server-side validation with usage limits and expiry checks
  - `applyDiscountCode()` - Apply discount to payment with usage tracking
  - `createAutomaticDiscountCode()` - Generate automatic discount codes
  - `getFamilyDiscountUsage()` - Track family-level discount usage
  - `getStudentDiscountUsage()` - Track student-level discount usage

#### API Endpoints
- **Validation API** (`app/routes/api.discount-codes.validate.tsx`)
  - POST endpoint for real-time discount code validation
  - Supports both family and student-level discounts
  - Returns discount amount and validation status

- **Available Discounts API** (`app/routes/api.available-discounts.$familyId.tsx`)
  - GET endpoint to fetch available discounts for a family
  - Filters by applicability (training, store, both)
  - Excludes already used one-time discounts

- **Admin Management API** (`app/routes/api.admin.discount-codes.tsx`)
  - CRUD operations for discount code management
  - Bulk operations support
  - Usage statistics and reporting

#### User Interface Components
- **DiscountCodeSelector** (`app/components/DiscountCodeSelector.tsx`)
  - Real-time discount code input and validation
  - Visual feedback for applied discounts
  - Integration with payment flow

#### Admin Interface
- **Discount Codes List** (`app/routes/admin.discount-codes._index.tsx`)
  - Comprehensive list view with filtering and search
  - Usage statistics and status indicators
  - Bulk actions (activate/deactivate)

- **Create Discount Code** (`app/routes/admin.discount-codes.new.tsx`)
  - Form for creating new discount codes
  - Support for all discount types and restrictions
  - Validation and error handling

#### Type Safety & Code Quality
- **TypeScript Definitions** (`app/types/discount.ts`, `app/types/supabase-extensions.d.ts`)
  - Comprehensive type definitions for discount system
  - Extended Supabase client types for type-safe database queries
  - Proper handling of nullable fields and relationships

- **Code Quality Improvements**
  - Resolved all TypeScript compilation errors
  - Fixed ESLint warnings and errors
  - Proper error handling and logging
  - Consistent code style and patterns

### Technical Fixes Completed
1. **Type Safety**: Added proper TypeScript definitions for all discount-related types
2. **Database Integration**: Extended Supabase client types for type-safe queries
3. **Error Handling**: Implemented comprehensive error handling throughout the system
4. **Code Quality**: Resolved all linting issues and TypeScript errors
5. **Performance**: Optimized database queries and added proper indexing
6. **Security**: Server-side validation and proper access controls

## Technical Considerations

### Discount Calculation Logic
- Fixed amount: Subtract exact dollar amount
- Percentage: Calculate percentage of subtotal (before tax)
- Ensure final amount never goes below $0
- Apply discount before tax calculation

### Security
- Validate discount codes server-side
- Prevent duplicate usage for one-time codes
- Check validity dates and usage limits
- Audit trail for all discount usage

### Performance
- Index on discount code for fast lookups
- Cache active discount codes
- Efficient queries for usage validation

### User Experience
- Real-time validation and calculation
- Clear error messages for invalid codes
- Visual feedback for applied discounts
- Easy removal of applied discounts

## API Endpoints

### Admin Endpoints
- `GET /admin/discount-codes` - List all discount codes
- `POST /admin/discount-codes` - Create new discount code
- `PUT /admin/discount-codes/:id` - Update discount code
- `DELETE /admin/discount-codes/:id` - Deactivate discount code
- `GET /admin/discount-codes/:id/usage` - View usage statistics

### User Endpoints
- `POST /api/validate-discount-code` - Validate and calculate discount
- `GET /api/available-discounts/:familyId` - Get available discounts for family

## Testing Strategy

### Unit Tests
- Discount calculation logic
- Validation functions
- Usage tracking

### Integration Tests
- End-to-end payment flow with discounts
- Admin discount management
- Edge cases (expired codes, usage limits)

### Manual Testing
- User experience flows
- Admin workflows
- Error handling scenarios