-- Payment System Data Integrity Diagnostic Query
-- Use this to identify potential data issues that could cause payment page errors
-- Run this query in Supabase SQL Editor or your database client

-- ============================================
-- 1. Payments with missing family records
-- ============================================
SELECT
    'Missing Family' as issue_type,
    p.id as payment_id,
    p.family_id,
    p.type,
    p.status,
    p.created_at
FROM payments p
LEFT JOIN families f ON f.id = p.family_id
WHERE f.id IS NULL
ORDER BY p.created_at DESC;

-- ============================================
-- 2. Payments with orphaned payment_students
-- ============================================
SELECT
    'Orphaned Student Reference' as issue_type,
    p.id as payment_id,
    ps.student_id,
    p.type,
    p.status,
    p.created_at
FROM payments p
JOIN payment_students ps ON ps.payment_id = p.id
LEFT JOIN students s ON s.id = ps.student_id
WHERE s.id IS NULL
ORDER BY p.created_at DESC;

-- ============================================
-- 3. Individual session payments with missing student enrollments
-- ============================================
SELECT
    'Missing Enrollment' as issue_type,
    p.id as payment_id,
    p.family_id,
    ps.student_id,
    CONCAT(s.first_name, ' ', s.last_name) as student_name,
    p.status,
    p.created_at
FROM payments p
JOIN payment_students ps ON ps.payment_id = p.id
JOIN students s ON s.id = ps.student_id
LEFT JOIN enrollments e ON e.student_id = s.id AND e.status IN ('active', 'trial')
WHERE p.type = 'individual_session'
  AND e.id IS NULL
ORDER BY p.created_at DESC;

-- ============================================
-- 4. Enrollments with missing program or class references
-- ============================================
SELECT
    'Broken Enrollment FK' as issue_type,
    e.id as enrollment_id,
    e.student_id,
    e.class_id,
    e.program_id,
    CONCAT(s.first_name, ' ', s.last_name) as student_name
FROM enrollments e
JOIN students s ON s.id = e.student_id
LEFT JOIN classes c ON c.id = e.class_id
LEFT JOIN programs pr ON pr.id = e.program_id
WHERE (c.id IS NULL OR pr.id IS NULL)
  AND e.status IN ('active', 'trial')
ORDER BY e.created_at DESC;

-- ============================================
-- 5. Payments with NULL or invalid amount values
-- ============================================
SELECT
    'Invalid Amount' as issue_type,
    id as payment_id,
    family_id,
    type,
    status,
    subtotal_amount,
    total_amount,
    created_at
FROM payments
WHERE subtotal_amount IS NULL
   OR total_amount IS NULL
   OR subtotal_amount < 0
   OR total_amount < 0
   OR total_amount < subtotal_amount
ORDER BY created_at DESC;

-- ============================================
-- 6. Payment taxes with missing tax rate references
-- ============================================
SELECT
    'Missing Tax Rate' as issue_type,
    pt.payment_id,
    pt.tax_rate_id,
    pt.tax_name_snapshot,
    pt.tax_amount,
    p.created_at
FROM payment_taxes pt
JOIN payments p ON p.id = pt.payment_id
LEFT JOIN tax_rates tr ON tr.id = pt.tax_rate_id
WHERE tr.id IS NULL AND pt.tax_rate_id IS NOT NULL
ORDER BY p.created_at DESC;

-- ============================================
-- 7. Individual session payments without pricing info
-- ============================================
SELECT
    'No Individual Session Pricing' as issue_type,
    p.id as payment_id,
    p.family_id,
    ps.student_id,
    CONCAT(s.first_name, ' ', s.last_name) as student_name,
    e.id as enrollment_id,
    c.name as class_name,
    pr.name as program_name,
    pr.individual_session_fee_cents,
    p.status,
    p.created_at
FROM payments p
JOIN payment_students ps ON ps.payment_id = p.id
JOIN students s ON s.id = ps.student_id
LEFT JOIN enrollments e ON e.student_id = s.id AND e.status IN ('active', 'trial')
LEFT JOIN classes c ON c.id = e.class_id
LEFT JOIN programs pr ON pr.id = c.program_id
WHERE p.type = 'individual_session'
  AND (pr.individual_session_fee_cents IS NULL OR pr.individual_session_fee_cents = 0)
ORDER BY p.created_at DESC;

-- ============================================
-- 8. Recent pending payments (potential stuck payments)
-- ============================================
SELECT
    'Pending Payment' as issue_type,
    id as payment_id,
    family_id,
    type,
    status,
    payment_intent_id,
    created_at,
    NOW() - created_at as age
FROM payments
WHERE status = 'pending'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- ============================================
-- 9. Families without profiles (RLS issue potential)
-- ============================================
SELECT
    'Family Without Profile' as issue_type,
    f.id as family_id,
    f.name as family_name,
    COUNT(p.id) as payment_count,
    MAX(p.created_at) as last_payment_attempt
FROM families f
LEFT JOIN profiles pr ON pr.family_id = f.id
LEFT JOIN payments p ON p.family_id = f.id
WHERE pr.id IS NULL
GROUP BY f.id, f.name
HAVING COUNT(p.id) > 0
ORDER BY MAX(p.created_at) DESC;

-- ============================================
-- 10. Summary: Overall data health check
-- ============================================
SELECT
    'Total Payments' as metric,
    COUNT(*) as count
FROM payments
UNION ALL
SELECT
    'Pending Payments',
    COUNT(*)
FROM payments
WHERE status = 'pending'
UNION ALL
SELECT
    'Payments Missing Family',
    COUNT(*)
FROM payments p
LEFT JOIN families f ON f.id = p.family_id
WHERE f.id IS NULL
UNION ALL
SELECT
    'Orphaned Payment Students',
    COUNT(DISTINCT ps.payment_id)
FROM payment_students ps
LEFT JOIN students s ON s.id = ps.student_id
WHERE s.id IS NULL
UNION ALL
SELECT
    'Invalid Amounts',
    COUNT(*)
FROM payments
WHERE subtotal_amount IS NULL
   OR total_amount IS NULL
   OR total_amount < subtotal_amount;
