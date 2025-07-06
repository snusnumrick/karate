import { AutoDiscountService } from '~/services/auto-discount.server';

/**
 * Utility functions to record discount events from various parts of the application
 * These should be called from existing business logic flows
 */

/**
 * Record student enrollment event
 * Call this when a new student is successfully registered
 */
export async function recordStudentEnrollmentEvent(
  studentId: string,
  familyId: string
): Promise<void> {
  try {
    await AutoDiscountService.recordStudentEnrollment(studentId, familyId);
    console.log(`Student enrollment event recorded for student ${studentId}`);
  } catch (error) {
    console.error('Failed to record student enrollment event:', error);
    // Don't throw - we don't want to break the main flow if discount assignment fails
  }
}

/**
 * Record first payment event
 * Call this when a family makes their first successful payment
 */
export async function recordFirstPaymentEvent(
  familyId: string,
  paymentAmount: number
): Promise<void> {
  try {
    // Check if this is actually the first payment
    const isFirstPayment = await checkIfFirstPayment(familyId);
    
    if (isFirstPayment) {
      await AutoDiscountService.recordFirstPayment(familyId, paymentAmount);
      console.log(`First payment event recorded for family ${familyId}`);
    }
  } catch (error) {
    console.error('Failed to record first payment event:', error);
  }
}

/**
 * Record belt promotion event
 * Call this when a student receives a belt promotion
 */
export async function recordBeltPromotionEvent(
  studentId: string,
  familyId: string,
  newBeltRank: string
): Promise<void> {
  try {
    await AutoDiscountService.recordBeltPromotion(studentId, familyId, newBeltRank);
    console.log(`Belt promotion event recorded for student ${studentId} - ${newBeltRank}`);
  } catch (error) {
    console.error('Failed to record belt promotion event:', error);
  }
}

/**
 * Record attendance milestone event
 * Call this when a student reaches certain attendance milestones
 */
export async function recordAttendanceMilestoneEvent(
  studentId: string,
  familyId: string,
  attendanceCount: number
): Promise<void> {
  try {
    // Only record for milestone numbers (e.g., 5, 10, 15, 20, etc.)
    if (attendanceCount % 5 === 0) {
      await AutoDiscountService.recordAttendanceMilestone(studentId, familyId, attendanceCount);
      console.log(`Attendance milestone event recorded for student ${studentId} - ${attendanceCount} classes`);
    }
  } catch (error) {
    console.error('Failed to record attendance milestone event:', error);
  }
}

/**
 * Record birthday event
 * Call this on or near a student's birthday
 */
export async function recordBirthdayEvent(
  studentId: string,
  familyId: string
): Promise<void> {
  try {
    await AutoDiscountService.recordEvent({
      event_type: 'birthday',
      student_id: studentId,
      family_id: familyId,
      event_data: {
        birthday_date: new Date().toISOString(),
      },
    });
    console.log(`Birthday event recorded for student ${studentId}`);
  } catch (error) {
    console.error('Failed to record birthday event:', error);
  }
}

/**
 * Record family referral event
 * Call this when a family refers another family that successfully enrolls
 */
export async function recordFamilyReferralEvent(
  referringFamilyId: string,
  newFamilyId: string
): Promise<void> {
  try {
    await AutoDiscountService.recordEvent({
      event_type: 'family_referral',
      family_id: referringFamilyId,
      event_data: {
        referred_family_id: newFamilyId,
        referral_date: new Date().toISOString(),
      },
    });
    console.log(`Family referral event recorded for family ${referringFamilyId}`);
  } catch (error) {
    console.error('Failed to record family referral event:', error);
  }
}

/**
 * Record seasonal promotion event
 * Call this during special promotional periods
 */
export async function recordSeasonalPromotionEvent(
  familyId: string,
  studentId?: string,
  promotionName?: string
): Promise<void> {
  try {
    await AutoDiscountService.recordEvent({
      event_type: 'seasonal_promotion',
      family_id: familyId,
      student_id: studentId,
      event_data: {
        promotion_name: promotionName,
        promotion_date: new Date().toISOString(),
      },
    });
    console.log(`Seasonal promotion event recorded for family ${familyId}`);
  } catch (error) {
    console.error('Failed to record seasonal promotion event:', error);
  }
}

/**
 * Helper function to check if this is a family's first payment
 */
async function checkIfFirstPayment(familyId: string): Promise<boolean> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data, error } = await supabase
      .from('payments')
      .select('id')
      .eq('family_id', familyId)
      .eq('status', 'succeeded')
      .limit(2); // Get up to 2 to check if this is the first
    
    if (error) {
      console.error('Error checking payment history:', error);
      return false;
    }
    
    return (data?.length || 0) === 1; // True if this is the only successful payment
  } catch (error) {
    console.error('Error in checkIfFirstPayment:', error);
    return false;
  }
}

/**
 * Batch process events for existing data
 * This can be used to retroactively create events for existing students/families
 */
export async function batchProcessExistingData(): Promise<void> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('Starting batch processing of existing data...');
    
    // Process existing students for enrollment events
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, family_id');
    
    if (studentsError) {
      console.error('Error fetching students:', studentsError);
      return;
    }
    
    for (const student of students || []) {
      try {
        await AutoDiscountService.recordEvent({
          event_type: 'student_enrollment',
          student_id: student.id,
          family_id: student.family_id,
          event_data: {
            enrollment_date: new Date().toISOString(),
            retroactive: true,
          },
        });
      } catch (error) {
        console.error(`Failed to create enrollment event for student ${student.id}:`, error);
      }
    }
    
    console.log(`Processed ${students?.length || 0} student enrollment events`);
    
    // Process existing payments for first payment events
    const { data: families, error: familiesError } = await supabase
      .from('families')
      .select('id');
    
    if (familiesError) {
      console.error('Error fetching families:', familiesError);
      return;
    }
    
    for (const family of families || []) {
      try {
        const { data: firstPayment, error: paymentError } = await supabase
          .from('payments')
          .select('id, amount, created_at')
          .eq('family_id', family.id)
          .eq('status', 'succeeded')
          .order('created_at')
          .limit(1)
          .single();
        
        if (!paymentError && firstPayment) {
          await AutoDiscountService.recordEvent({
            event_type: 'first_payment',
            family_id: family.id,
            event_data: {
              payment_amount: firstPayment.amount,
              payment_date: firstPayment.created_at,
              retroactive: true,
            },
          });
        }
      } catch (error) {
        // Ignore errors for families without payments
      }
    }
    
    console.log('Batch processing completed');
  } catch (error) {
    console.error('Error in batch processing:', error);
  }
}