import { useMemo } from 'react';
import { useNavigate } from '@remix-run/react';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { PaymentForm } from '~/components/PaymentForm';
import { PaymentEligibilityData } from '~/services/payment-eligibility.server';
import {EligibilityStatus, StudentPaymentDetail} from '~/types/payment';
import type { StudentPaymentOptions } from '~/services/enrollment-payment.server';

interface StudentPaymentSectionProps {
  familyId: string;
  enrollmentId?: string;
  appearance?: 'default' | 'simplified';
  paymentEligibilityData?: PaymentEligibilityData | null;
  paymentOptions?: StudentPaymentOptions | null;
}

export function StudentPaymentSection({ familyId, enrollmentId, appearance = 'default', paymentEligibilityData, paymentOptions }: StudentPaymentSectionProps) {
  const navigate = useNavigate();

  // Handle successful payment submission
  const handlePaymentSuccess = (paymentId: string, zeroPayment?: boolean) => {
    if (zeroPayment) {
      // For a zero-dollar "payment" (e.g., 100% discount), redirect to the family page
      // as there's no payment gateway step.
      navigate('/family');
    } else {
      // For payments requiring a transaction, navigate to the dedicated pay page.
      navigate(`/pay/${paymentId}`);
    }
  };

  // Data now comes from props. Can add a loading state if props are not yet available.
  const isLoading = !paymentEligibilityData || (enrollmentId && !paymentOptions);

  // Handle enrollment-specific data from props
  const selectedEnrollment = enrollmentId ? paymentOptions?.enrollments.find(e => e.enrollmentId === enrollmentId) : null;
  
  // Handle general eligibility data
  const eligibilityData : PaymentEligibilityData | null = paymentEligibilityData || null;
  const hasEligibilityError = eligibilityData && 'error' in eligibilityData;
  const eligibilityStatus: EligibilityStatus | undefined = eligibilityData?.studentPaymentDetails?.[0]?.eligibility;

  // Memoize studentPaymentDetails to prevent infinite re-renders (must be at top level)
  const memoizedStudentPaymentDetails : StudentPaymentDetail[] = useMemo(() => {
    if (!selectedEnrollment) return [];
    return [{
      studentId: selectedEnrollment.studentId,
      firstName: selectedEnrollment.studentName.split(' ')[0],
      lastName: selectedEnrollment.studentName.split(' ').slice(1).join(' '),
      eligibility: eligibilityStatus,
      needsPayment: !selectedEnrollment.hasActiveSubscription,
      nextPaymentAmount: selectedEnrollment.monthlyAmount || selectedEnrollment.individualSessionAmount || 0,
      nextPaymentTierLabel: selectedEnrollment.monthlyAmount ? 'Monthly' : 'Individual Session',
      // nextPaymentPriceId: "", // TODO: Map to actual price IDs
      pastPaymentCount: 0,
      individualSessions: eligibilityData?.studentPaymentDetails?.[0]?.individualSessions
    }];
  }, [selectedEnrollment, eligibilityData, eligibilityStatus]);

  // Memoize enrollmentPricing to prevent infinite re-renders (must be at top level)
  const memoizedEnrollmentPricing = useMemo(() => {
    if (!selectedEnrollment) return {};
    return {
      monthlyAmount: selectedEnrollment.monthlyAmount,
      yearlyAmount: selectedEnrollment.yearlyAmount,
      individualSessionAmount: selectedEnrollment.individualSessionAmount
    };
  }, [selectedEnrollment]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading payment options...</span>
      </div>
    );
  }

  // Handle enrollment-specific view
  if (enrollmentId) {
    if (!paymentOptions || !selectedEnrollment || !familyId) {
      return (
        <Alert variant="destructive">
          <ExclamationTriangleIcon className="h-4 w-4" />
          <AlertDescription>
            Failed to load payment options for this enrollment.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-6">
        {/* Payment Form - Clean integration */}
      <PaymentForm 
        familyId={familyId}
        enrollmentId={enrollmentId}
        mode="student"
        hasAvailableDiscounts={true} // Enable discounts for enrollment mode
        actionEndpoint="/family/payment"
        enrollmentPricing={memoizedEnrollmentPricing}
        supportedPaymentTypes={selectedEnrollment.supportedPaymentTypes}
        studentPaymentDetails={memoizedStudentPaymentDetails}
        appearance={appearance}
        onSuccess={handlePaymentSuccess}
      />
      </div>
    );
  }

  // Handle general eligibility view
  if (hasEligibilityError) {
    return (
      <Alert variant="destructive">
        <ExclamationTriangleIcon className="h-4 w-4" />
        <AlertDescription>
          {eligibilityData?.error || 'Failed to load payment options'}
        </AlertDescription>
      </Alert>
    );
  }

  if (!eligibilityData || eligibilityData.studentPaymentDetails.length === 0) {
    return (
      <Alert>
        <InfoCircledIcon className="h-4 w-4" />
        <AlertDescription>
          {eligibilityData?.error || 'No payment options available for this student.'}
        </AlertDescription>
      </Alert>
    );
  }

  const studentDetail = eligibilityData.studentPaymentDetails[0];
  const individualSessions = studentDetail?.individualSessions;

  return (
    <div className="space-y-6">
      {/* Individual Sessions Information - Keep only if has sessions */}
      {individualSessions && (individualSessions.totalPurchased > 0 || individualSessions.totalRemaining > 0) && (
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-200 dark:border-green-700">
          <h3 className="font-semibold text-green-900 dark:text-green-100 mb-3">Individual Sessions</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                {individualSessions.totalPurchased}
              </p>
              <p className="text-green-700 dark:text-green-300">Purchased</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                {individualSessions.totalRemaining}
              </p>
              <p className="text-green-700 dark:text-green-300">Remaining</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                {individualSessions.totalPurchased - individualSessions.totalRemaining}
              </p>
              <p className="text-green-700 dark:text-green-300">Used</p>
            </div>
          </div>
        </div>
      )}

      {/* Payment Form - Clean integration */}
      <PaymentForm 
        familyId={familyId}
        enrollmentId={enrollmentId}
        mode="student"
        hasAvailableDiscounts={eligibilityData.hasAvailableDiscounts}
        actionEndpoint="/family/payment"
        studentPaymentDetails={eligibilityData.studentPaymentDetails}
        appearance={appearance}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
