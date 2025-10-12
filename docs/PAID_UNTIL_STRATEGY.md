# Paid Until Calculation & Enrollment Management Strategy

**Document Version:** 1.0
**Date:** October 12, 2025
**Status:** Phase 1 Implemented, Phase 2 Documented for Future

---

## Executive Summary

This document outlines a two-phase approach to improving payment and enrollment management:
1. **Phase 1 (Implemented)**: Intelligent `paid_until` calculation that's fair to students
2. **Phase 2 (Future)**: Graduated enrollment status management for long-overdue accounts

---

## Current State Analysis

### Original Logic (Too Simplistic)
```typescript
// If paid_until is in the future, extend from that date
// Otherwise, extend from today
const startDate = currentPaidUntil > nowUTC ? currentPaidUntil : nowUTC;
const newPaidUntil = new Date(startDate);
newPaidUntil.setUTCMonth(newPaidUntil.getUTCMonth() + 1);
```

### Problems Identified
- **Unfair advantage for late payers**: Families who pay late get their membership extended from payment date, effectively rewarding delays
- **Penalizes on-time payers**: Families who pay promptly don't get any benefit compared to those who delay payment
- **No consideration of attendance**: Students who continue attending despite expired payment get the same treatment as no-shows
- **No grace period for minor delays**: Even 1-day late results in extending from payment date rather than expiration
- **Not business-friendly**: Creates perverse incentive to delay payment to extend coverage

### Real-World Example
```
Scenario: Family pays on Oct 10, 2025
- paid_until expired: Oct 1, 2025
- Current logic result: Nov 10, 2025
- Problem: Late-paying family gets unfair advantage - 9 extra days compared to families who paid on time
- Fair result should be: Nov 1, 2025 (if within grace period or student attended)
```

---

## Phase 1: Intelligent paid_until Calculation (IMPLEMENTED)

### Objective
Make the calculation fair while preventing abuse, rewarding loyalty, and maintaining revenue.

### Business Rules

#### Rule 1: Grace Period Extension
**Condition:** Payment received within 7 days of expiration
**Action:** Extend from expiration date (not payment date)
**Rationale:** Forgive minor delays, reward prompt payers

**Example:**
```
Expired: October 1, 2025
Payment: October 5, 2025 (4 days late)
Result: November 1, 2025 (not November 5)
Reason: Within 7-day grace period
```

#### Rule 2: Attendance-Based Credit
**Condition:** Student attended any class after expiration (within 30 days lookback)
**Action:** Extend from expiration date (retroactive credit)
**Rationale:** Reward loyal students who continue attending despite expired payment

**Example:**
```
Expired: October 1, 2025
Attended: October 3, 2025 (status='present')
Payment: October 15, 2025 (14 days late)
Result: November 1, 2025 (not November 15)
Reason: Student attended after expiration, giving retroactive credit
```

#### Rule 3: Default Behavior (No Grace)
**Condition:** Neither grace period nor attendance applies
**Action:** Extend from payment date
**Rationale:** Prevent free months for long-term delinquent accounts

**Example:**
```
Expired: October 1, 2025
No attendance after expiration
Payment: October 20, 2025 (19 days late)
Result: November 20, 2025
Reason: Outside grace period, no attendance
```

### Configuration Parameters

```typescript
// app/config/site.ts
payment: {
  gracePeriodDays: 7,           // Days after expiration to still credit from expiration
  attendanceLookbackDays: 30,   // How far back to check for attendance after expiration
}
```

### Decision Matrix

| Days Late | Attended After? | Grace Period? | Extend From    | Rule Applied |
|-----------|-----------------|---------------|----------------|--------------|
| 0-7       | -               | Yes           | Expiration     | Grace Period |
| 8-30      | Yes             | No            | Expiration     | Attendance   |
| 8-30      | No              | No            | Payment Date   | Default      |
| 31+       | Yes             | No            | Expiration     | Attendance   |
| 31+       | No              | No            | Payment Date   | Default      |

### Implementation Components

#### 1. Configuration (`app/config/site.ts`)
```typescript
export const siteConfig = {
  // ... existing config
  payment: {
    gracePeriodDays: 7,
    attendanceLookbackDays: 30,
  }
}
```

#### 2. Calculator Service (`app/services/payments/paid-until-calculator.server.ts`)
Main service providing:
```typescript
export async function calculatePaidUntil(
  enrollment: EnrollmentRecord,
  paymentDate: Date,
  paymentType: 'monthly_group' | 'yearly_group'
): Promise<{
  newPaidUntil: Date;
  reason: string;
  ruleApplied: 'grace_period' | 'attendance_credit' | 'default';
}>

async function checkAttendanceAfterExpiration(
  studentId: string,
  expirationDate: Date,
  lookbackDays: number
): Promise<Date | null>
```

#### 3. Updated Payment Handler (`app/utils/supabase.server.ts`)
Replaced simple calculation with intelligent calculator:
```typescript
const { newPaidUntil, reason, ruleApplied } = await calculatePaidUntil(
  enrollment,
  new Date(),
  type
);

console.log(`[updatePaymentStatus] Calculated paid_until=${newPaidUntil.toISOString()} for enrollment ${enrollment.id}: ${reason}`);
```

### Logging & Monitoring

Each calculation logs detailed reasoning:
```
[paid_until] Enrollment abc123: Extended from expiration to 2025-11-01
  (grace period: 4 days late)

[paid_until] Enrollment xyz789: Extended from expiration to 2025-11-01
  (attendance credit: attended on 2025-10-03)

[paid_until] Enrollment def456: Extended from payment date to 2025-11-20
  (default: 19 days late, no attendance)
```

### Success Metrics

- ✅ Reduction in customer support inquiries about "lost days"
- ✅ Increased on-time payment rate (within 7 days)
- ✅ Maintained attendance for slightly late payers
- ✅ No increase in long-term delinquencies

---

## Phase 2: Graduated Enrollment Status Management (FUTURE)

### Objective
Automate enrollment status transitions for long-overdue accounts while maintaining fairness and relationship preservation.

**NOTE:** This phase is documented but NOT implemented. Proceed only when business data shows:
- More than 5% of students consistently 30+ days overdue
- Admin spending 5+ hours/week on payment follow-up
- Pattern of students attending without payment
- Significant revenue loss from non-payment

### Status Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│ ACTIVE                                                      │
│ Can attend classes, receiving email reminders              │
│ Grace period & attendance credit available                 │
└──────────────────────┬──────────────────────────────────────┘
                       │ 31 days overdue
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ INACTIVE (Suspended)                                        │
│ Cannot attend classes, weekly escalated emails             │
│ Automatic reactivation upon payment                        │
│ No registration fee required                               │
└──────────────────────┬──────────────────────────────────────┘
                       │ 61 days overdue
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ DROPPED                                                     │
│ Removed from roster, final notice email                    │
│ Must re-enroll with registration fee                       │
│ Admin can override for special circumstances               │
└─────────────────────────────────────────────────────────────┘
```

### Timeline & Actions

| Phase | Days Overdue | Status | Can Attend? | Actions |
|-------|-------------|--------|-------------|---------|
| Grace | 1-7 | Active | Yes | Friendly reminder (day 3) |
| Warning | 8-30 | Active | Yes | Weekly reminder emails |
| Suspended | 31-60 | Inactive | **No** | "Account suspended" email, blocked at check-in |
| Dropped | 61+ | Dropped | No | Final notice, requires re-enrollment with fee |

### Automated Actions (Not Implemented)

#### Daily Cron Job (2 AM)
```typescript
// app/routes/api.cron.enrollment-status.ts

1. Query all enrollments where paid_until < today - 30 days AND status = 'active'
   → Update status to 'inactive'
   → Send suspension email
   → Log action

2. Query all enrollments where paid_until < today - 60 days AND status = 'inactive'
   → Update status to 'dropped'
   → Send final notice email
   → Log action

3. Query all enrollments where paid_until < today - 3 days AND status = 'active'
   → Send first reminder email
```

#### Payment-Triggered Reactivation
```typescript
// In updatePaymentStatus() after successful payment:

if (enrollment.status === 'inactive' && daysOverdue <= 60) {
  // Auto-reactivate suspended enrollments
  await supabaseAdmin
    .from('enrollments')
    .update({ status: 'active' })
    .eq('id', enrollmentId);

  console.log(`[Reactivation] Enrollment ${enrollmentId} reactivated after payment`);
}

if (enrollment.status === 'dropped') {
  // Require new enrollment with registration fee
  throw new Error(
    'This enrollment was dropped due to non-payment. ' +
    'Please contact the school to re-enroll with registration fee.'
  );
}
```

### Configuration (Future)

```typescript
// app/config/site.ts
enrollmentManagement: {
  // Status transition thresholds
  gracePeriodDays: 7,
  warningPeriodDays: 30,
  suspensionThresholdDays: 31,
  autoDropThresholdDays: 61,

  // Communication schedule
  reminderSchedule: [3, 7, 14, 21, 28],  // Days after expiration to send emails

  // Policy flags
  allowAutoReactivation: true,        // Suspended students can pay to reactivate
  requireAdminApprovalForDropped: false,  // Dropped students need admin to re-enroll

  // Exceptions
  skipAutoDropForScholarships: true,  // Don't auto-drop scholarship students
  pauseDuringBreaks: true,            // Pause countdown during summer break
}
```

### Re-Enrollment Fee Logic (Future)

#### When Registration Fee Would Be Required:
1. Enrollment status = `dropped` (60+ days overdue)
2. Manually dropped by admin
3. Student returning after 6+ months inactive

#### Payment Structure for Dropped Students:
```typescript
if (enrollment.status === 'dropped') {
  const program = await getProgram(enrollment.program_id);

  return {
    paymentType: 're_enrollment_fee',
    subtotal: program.registration_fee_cents + program.monthly_fee_cents,
    lineItems: [
      {
        description: 'Re-enrollment Fee',
        amount: program.registration_fee_cents,
        type: 're_enrollment_fee'
      },
      {
        description: 'First Month Tuition',
        amount: program.monthly_fee_cents,
        type: 'monthly_group'
      }
    ]
  };
}
```

### Check-In System Integration (Future)

```typescript
// app/services/attendance.server.ts

export async function canStudentAttend(studentId: string): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const enrollment = await getActiveEnrollment(studentId);

  if (!enrollment) {
    return { allowed: false, reason: 'No active enrollment' };
  }

  if (enrollment.status === 'inactive') {
    return {
      allowed: false,
      reason: 'Account suspended due to non-payment. Please pay to reactivate.'
    };
  }

  if (enrollment.status === 'dropped') {
    return {
      allowed: false,
      reason: 'Enrollment was dropped. Please contact us to re-enroll.'
    };
  }

  if (enrollment.paid_until < new Date()) {
    // Still allow if within grace period (7 days)
    const daysOverdue = daysBetween(enrollment.paid_until, new Date());
    if (daysOverdue <= 7) {
      return { allowed: true }; // Within grace period
    }
    return {
      allowed: false,
      reason: `Payment overdue by ${daysOverdue} days. Please pay to continue.`
    };
  }

  return { allowed: true };
}
```

### UI Updates (Future)

#### Family Portal
```
┌─────────────────────────────────────────────────────────┐
│ Student: John Smith                                     │
│ Status: ⚠️  OVERDUE (12 days)                           │
│                                                         │
│ Your enrollment is overdue. Please pay by Oct 19 to    │
│ avoid suspension. [Pay Now Button]                     │
│                                                         │
│ Timeline:                                               │
│ ✓ Oct 1 - Payment due                                  │
│ ✓ Oct 3 - Reminder sent                                │
│ ✓ Oct 8 - Warning period started                       │
│ → Oct 19 - Account will be suspended (19 days away)    │
│ → Nov 8 - Account will be dropped (38 days away)       │
└─────────────────────────────────────────────────────────┘
```

#### Admin Dashboard
```
┌─────────────────────────────────────────────────────────┐
│ Enrollment Status Report                                │
│                                                         │
│ 🟢 Active (paid up): 45 students                       │
│ 🟡 Overdue (1-30 days): 8 students                     │
│ 🟠 Suspended (31-60 days): 2 students                  │
│ 🔴 Dropped (61+ days): 1 student                       │
│                                                         │
│ Actions Required:                                       │
│ • 3 students approaching suspension (next 7 days)      │
│ • 1 student approaching drop (next 7 days)             │
│                                                         │
│ [View Details] [Send Bulk Reminders] [Export Report]   │
└─────────────────────────────────────────────────────────┘
```

### Implementation Components (Future)

#### New Files Would Include:
1. `app/services/enrollment-status-manager.server.ts` (~250 lines)
2. `app/services/__tests__/enrollment-status-manager.test.ts` (~150 lines)
3. `app/routes/api.cron.enrollment-status.ts` (~100 lines)
4. `app/routes/admin.enrollments.status-report.tsx` (~200 lines, admin UI)

#### Database Changes Would Include:
```sql
-- Add new payment type for re-enrollment
ALTER TYPE public.payment_type_enum ADD VALUE IF NOT EXISTS 're_enrollment_fee';

-- Add index for efficient status queries
CREATE INDEX IF NOT EXISTS idx_enrollments_status_paid_until
  ON enrollments(status, paid_until)
  WHERE status IN ('active', 'inactive');
```

### Migration Path (Future)

#### Week 1: Infrastructure Only
- Deploy services with logging only (no status changes)
- Monitor logs to verify logic
- Test email templates

#### Week 2-3: Soft Launch
- Enable email reminders
- Show status warnings in UI
- Still allow all students to attend

#### Week 4: Full Enforcement
- Enable auto-suspension (day 31)
- Enable auto-drop (day 61)
- Enforce check-in blocking

#### Ongoing: Monitoring
- Weekly admin report on status changes
- Monthly review of edge cases
- Quarterly review of threshold days

### Edge Cases to Handle (Future)

#### 1. Family Payments
```typescript
// If any sibling pays, consider whole family active
const siblingsInSameFamily = await getSiblings(studentId);
const anyPaidUp = siblingsInSameFamily.some(s => s.enrollment.paid_until > today);

if (anyPaidUp) {
  // Don't suspend/drop this student
  return;
}
```

#### 2. Scheduled Breaks
```typescript
// Check if we're in a scheduled break period
const isOnBreak = await isSchoolOnBreak(today);

if (isOnBreak) {
  // Pause countdown during breaks
  return;
}
```

#### 3. Medical/Emergency Holds
```typescript
// Check for admin-placed holds
if (enrollment.hold_reason === 'medical' || enrollment.hold_reason === 'emergency') {
  // Don't suspend/drop - admin managing this case
  return;
}
```

#### 4. Scholarship Students
```typescript
if (enrollment.is_scholarship) {
  // Don't auto-drop scholarship students
  // But still send reminders and show warnings
  sendReminderOnly();
  return;
}
```

---

## Comparison: Phase 1 vs Phase 2

| Aspect | Phase 1 (paid_until) | Phase 2 (Status Management) |
|--------|----------------------|------------------------------|
| **Complexity** | Low | Medium-High |
| **Immediate Value** | High (fairness) | Medium (automation) |
| **Risk** | Low | Medium (customer relations) |
| **Development Time** | 1-2 days | 5-7 days |
| **Testing Required** | Moderate | Extensive |
| **Communication Needed** | Minimal | Extensive |
| **Reversibility** | Easy | Moderate (status changes) |

---

## Appendix A: Test Scenarios

### Phase 1 Test Cases (Implemented)

```typescript
// Grace Period Tests
test('payment 3 days late → extend from expiration')
test('payment 7 days late → extend from expiration')
test('payment 8 days late, no attendance → extend from payment date')

// Attendance Credit Tests
test('attended 2 days after expiration, paid 15 days late → extend from expiration')
test('attended 1 day before expiration, paid 15 days late → extend from payment date')
test('no attendance after expiration, paid 15 days late → extend from payment date')

// Edge Cases
test('payment on expiration date → extend from expiration')
test('payment 1 hour after expiration → extend from expiration (within grace)')
test('month-end: Jan 31 expired, paid Feb 3 → March 31 result')
test('timezone handling: UTC vs local time')

// Configuration Changes
test('grace period changed from 7 to 10 days → honors new config')
test('lookback changed from 30 to 60 days → finds older attendance')
```

### Phase 2 Test Cases (Future)

```typescript
// Status Transitions
test('31 days overdue → auto-suspend')
test('61 days overdue → auto-drop')
test('payment within suspension period → auto-reactivate')
test('payment after drop → require re-enrollment with fee')

// Check-In Blocking
test('suspended student tries to check in → blocked with message')
test('dropped student tries to check in → blocked with message')
test('active but overdue (within grace) → allowed to check in')

// Edge Cases
test('sibling payment prevents suspension')
test('scholarship flag prevents auto-drop')
test('school break pauses countdown')
test('manual admin hold prevents auto-actions')

// Communication
test('reminder emails sent on correct schedule')
test('suspension email includes reactivation link')
test('drop email includes re-enrollment instructions')
```

---

## Appendix B: Email Templates (Future Phase 2)

### Grace Period Reminder (Day 3)
```
Subject: Friendly Reminder: Payment Due Soon

Hi [Parent Name],

This is a friendly reminder that [Student Name]'s tuition payment
was due on [Due Date]. No worries - you still have a few days!

Pay by [Grace End Date] to maintain your benefits.

[Pay Now Button]

Amount Due: $[Amount]
Enrollment: [Program Name]

Questions? Reply to this email or call us at [Phone].

Thank you!
[School Name]
```

### Warning (Day 14)
```
Subject: Action Required: Overdue Payment for [Student Name]

Hi [Parent Name],

[Student Name]'s account is now 14 days overdue. To avoid any
interruption to their training, please pay as soon as possible.

[Pay Now Button]

Amount Due: $[Amount]
Original Due Date: [Due Date]

If you're experiencing financial difficulty, please contact us
to discuss options.

Thank you!
[School Name]
```

### Suspension Notice (Day 31)
```
Subject: URGENT: Account Suspended - [Student Name]

Hi [Parent Name],

Unfortunately, [Student Name]'s enrollment has been suspended
due to non-payment. They will not be able to attend classes
until payment is received.

[Pay Now to Reactivate]

Amount Due: $[Amount]
Overdue Since: [Due Date] (31 days)

Your account will be automatically reactivated as soon as
payment is received. No additional fees required.

Questions? Please contact us immediately.

[School Name]
```

### Drop Notice (Day 61)
```
Subject: Final Notice: Enrollment Dropped - [Student Name]

Hi [Parent Name],

After 61 days without payment, [Student Name]'s enrollment has
been permanently dropped from our system.

To re-enroll, you will need to:
1. Pay the re-enrollment fee: $[Registration Fee]
2. Pay the first month's tuition: $[Monthly Fee]
3. Contact us to discuss scheduling

We're sorry to see you go, but we hope you'll consider
returning in the future.

[Contact Us]

[School Name]
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-10-12 | Initial document creation with Phase 1 implementation and Phase 2 planning |

---

**End of Document**
