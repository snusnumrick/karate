import { useFetcher, useNavigate } from '@remix-run/react';
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { CheckCircledIcon, ExclamationTriangleIcon, ReloadIcon } from '@radix-ui/react-icons';
import { Checkbox } from '~/components/ui/checkbox';
import { formatDate } from '~/utils/misc';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { Label } from '~/components/ui/label';
import type { DiscountValidationResult } from '~/types/discount';
import {StudentPaymentDetail} from "~/types/payment";
import { AuthenticityTokenInput } from 'remix-utils/csrf/react';
import { DiscountSelector } from '~/components/DiscountSelector';
import {
    formatMoney,
    multiplyMoney,
    subtractMoney,
    Money,
    addMoney,
    ZERO_MONEY,
    maxMoney,
    isPositive,
    toCents,
    toMoney,
    fromCents
} from '~/utils/money';

// Payment options type
type PaymentOption = 'monthly' | 'yearly' | 'individual';

const paymentTypeMap: Record<string, PaymentOption> = {
  'monthly_subscription': 'monthly',
  'yearly_subscription': 'yearly',
  'individual_session': 'individual'
};

function determineInitialOption(
  initial: PaymentOption,
  supported?: string[]
): PaymentOption {
  if (!supported || supported.length === 0) {
    return initial;
  }
  const isInitialSupported = supported.some(type => paymentTypeMap[type] === initial);
  if (isInitialSupported) {
    return initial;
  }
  for (const type of supported) {
    const mappedOption = paymentTypeMap[type];
    if (mappedOption) {
      return mappedOption;
    }
  }
  return initial; // fallback
}

// Action response interface
interface ActionResponse {
  success?: boolean;
  supabasePaymentId?: string;
  zeroPayment?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  // Duplicate payment fields
  duplicatePaymentId?: string;
  duplicatePaymentAmount?: number;
  duplicatePaymentCreatedAt?: string;
}

interface PaymentSetupFormProps {
  familyId: string;
  studentPaymentDetails?: StudentPaymentDetail[];
  hasAvailableDiscounts: boolean;
  mode: 'family' | 'student';
  enrollmentId?: string; // Optional enrollment ID for enrollment-specific payments
  actionEndpoint?: string; // Custom action endpoint, defaults to current route
  onSuccess?: (paymentId: string, zeroPayment?: boolean) => void; // Custom success handler
  initialPaymentOption?: PaymentOption;
  className?: string;
  appearance?: 'simplified' | 'default';
  enrollmentPricing?: {
    monthlyAmount?: Money;
    yearlyAmount?: Money;
    individualSessionAmount?: Money;
  }; // Enrollment-specific pricing that overrides default pricing
  supportedPaymentTypes?: string[];
}

export function PaymentSetupForm({
  familyId,
  studentPaymentDetails = [],
  hasAvailableDiscounts,
  mode,
  enrollmentId,
  actionEndpoint = '/family/payment',
  onSuccess,
  initialPaymentOption = 'monthly',
  className = '',
  appearance = 'default',
  enrollmentPricing,
  supportedPaymentTypes
}: PaymentSetupFormProps) {

  const fetcher = useFetcher<ActionResponse>();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);

  const isSimplified = appearance === 'simplified';

  const paymentOptionContainerClasses = isSimplified
    ? 'bg-transparent dark:bg-transparent shadow-none border border-gray-200 dark:border-gray-700 p-4 mb-4 rounded-lg'
    : 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6';

  const paymentOptionHeaderClasses = isSimplified
    ? 'text-base font-semibold mb-3'
    : 'text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-600';

  // State management
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [paymentOption, setPaymentOption] = useState<PaymentOption>(
    determineInitialOption(initialPaymentOption, supportedPaymentTypes)
  );
  const [oneOnOneQuantity, setOneOnOneQuantity] = useState(1);
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountValidationResult | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(true);
  const [isSuccessHandled, setIsSuccessHandled] = useState(false);
  const [isDuplicateHandled, setIsDuplicateHandled] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<{
    paymentId: string;
    createdAt: string;
    totalAmount: number;
    discountAmount?: number | null;
    type?: string;
    studentNames?: string;
  } | null>(null);

  const pendingPaymentFetcher = useFetcher<{
    hasPendingPayment: boolean;
    paymentId?: string;
    createdAt?: string;
    totalAmount?: number;
    discountAmount?: number | null;
    type?: string;
    studentNames?: string;
  }>();

  // Rehydrate Money for studentPaymentDetails coming over the wire as JSON
  const rehydratedDetails = useMemo(() => {
    return (studentPaymentDetails || []).map(d => ({
      ...d,
      nextPaymentAmount: toMoney(d.nextPaymentAmount as unknown),
      monthlyAmount: d.monthlyAmount ? toMoney(d.monthlyAmount as unknown) : undefined,
      yearlyAmount: d.yearlyAmount ? toMoney(d.yearlyAmount as unknown) : undefined,
      individualSessionAmount: d.individualSessionAmount ? toMoney(d.individualSessionAmount as unknown) : undefined,
    }));
  }, [studentPaymentDetails]);

  const getMonthlyAmountForDetail = useCallback((detail: StudentPaymentDetail & { monthlyAmount?: Money }) => {
    if (enrollmentPricing?.monthlyAmount) return enrollmentPricing.monthlyAmount;
    return detail.monthlyAmount ?? detail.nextPaymentAmount;
  }, [enrollmentPricing]);

  const getYearlyAmountForDetail = useCallback((detail: StudentPaymentDetail & { yearlyAmount?: Money }) => {
    if (enrollmentPricing?.yearlyAmount) return enrollmentPricing.yearlyAmount;
    return detail.yearlyAmount ?? detail.nextPaymentAmount;
  }, [enrollmentPricing]);

  const defaultIndividualSessionAmount = useMemo(() => {
    if (enrollmentPricing?.individualSessionAmount) {
      return enrollmentPricing.individualSessionAmount;
    }
    const detailWithIndividual = rehydratedDetails.find(detail => detail.individualSessionAmount && isPositive(detail.individualSessionAmount));
    return detailWithIndividual?.individualSessionAmount ?? ZERO_MONEY;
  }, [enrollmentPricing, rehydratedDetails]);

  const displayMonthlyAmount = useMemo(() => {
    if (enrollmentPricing?.monthlyAmount) {
      return enrollmentPricing.monthlyAmount;
    }
    const detailWithMonthly = rehydratedDetails.find(detail => detail.monthlyAmount && isPositive(detail.monthlyAmount));
    if (detailWithMonthly?.monthlyAmount) {
      return detailWithMonthly.monthlyAmount;
    }
    const detailWithPositive = rehydratedDetails.find(detail => isPositive(detail.nextPaymentAmount));
    return detailWithPositive?.nextPaymentAmount ?? ZERO_MONEY;
  }, [enrollmentPricing, rehydratedDetails]);

  const displayYearlyAmount = useMemo(() => {
    if (enrollmentPricing?.yearlyAmount) {
      return enrollmentPricing.yearlyAmount;
    }
    const detailWithYearly = rehydratedDetails.find(detail => detail.yearlyAmount && isPositive(detail.yearlyAmount));
    if (detailWithYearly?.yearlyAmount) {
      return detailWithYearly.yearlyAmount;
    }
    return ZERO_MONEY;
  }, [enrollmentPricing, rehydratedDetails]);

  const displayIndividualAmount = useMemo(() => {
    if (isPositive(defaultIndividualSessionAmount)) {
      return defaultIndividualSessionAmount;
    }
    return ZERO_MONEY;
  }, [defaultIndividualSessionAmount]);

  // Reset success and duplicate handled states on new submission
  useEffect(() => {
    if (fetcher.state === 'submitting') {
      setIsSuccessHandled(false);
      setIsDuplicateHandled(false);
    }
  }, [fetcher.state]);

  // Initialize selected students for student mode
  useEffect(() => {
    if (mode === 'student' && rehydratedDetails[0]?.studentId) {
      setSelectedStudentIds(new Set([rehydratedDetails[0].studentId]));
    }
  }, [mode, rehydratedDetails]);

  // Auto-select first available payment option when supportedPaymentTypes changes
  useEffect(() => {
    if (supportedPaymentTypes && supportedPaymentTypes.length > 0) {
      const currentPaymentTypeSupported = supportedPaymentTypes.some(type => 
        paymentTypeMap[type] === paymentOption
      );

      if (!currentPaymentTypeSupported) {
        // Find the first supported payment option
        for (const supportedType of supportedPaymentTypes) {
          const mappedOption = paymentTypeMap[supportedType];
          if (mappedOption) {
            setPaymentOption(mappedOption);
            break;
          }
        }
      }
    }
  }, [supportedPaymentTypes, paymentOption]);

  // Determine if any student is eligible for group payment
  const hasEligibleStudentsForGroupPayment = true; //studentPaymentDetails.some(d => d.needsPayment);

  const computeRawSubtotal = useCallback(() => {
    let subtotal: Money = ZERO_MONEY;
    if (paymentOption === 'monthly' || paymentOption === 'yearly') {
      selectedStudentIds.forEach(id => {
        const detail = rehydratedDetails.find(d => d.studentId === id);
        if (!detail) return;
        const amount = paymentOption === 'yearly'
          ? getYearlyAmountForDetail(detail)
          : getMonthlyAmountForDetail(detail);
        subtotal = addMoney(subtotal, amount);
      });
    } else if (paymentOption === 'individual') {
      subtotal = multiplyMoney(defaultIndividualSessionAmount, oneOnOneQuantity);
    }
    return subtotal;
  }, [paymentOption, selectedStudentIds, rehydratedDetails, getYearlyAmountForDetail, getMonthlyAmountForDetail, defaultIndividualSessionAmount, oneOnOneQuantity]);

  // Dynamic calculation
  const calculateAmounts = useCallback(() => {
    const subtotal = computeRawSubtotal();
    const discountAmount: Money = appliedDiscount?.discount_amount ?? ZERO_MONEY;
    const discountedSubtotal: Money = maxMoney(ZERO_MONEY, subtractMoney(subtotal, discountAmount));
    return { subtotal, discountAmount, total: discountedSubtotal };
  }, [computeRawSubtotal, appliedDiscount]);

  const { subtotal: currentSubtotal, discountAmount: currentDiscountAmount, total: currentTotal } = calculateAmounts();
  const currentSubtotalDisplay = formatMoney(currentSubtotal);
  const currentDiscountDisplay = appliedDiscount ? formatMoney(currentDiscountAmount) : null;
  const currentTotalDisplay = formatMoney(currentTotal);

  // Helper to format pending payment message
  const formatPendingPaymentMessage = useCallback(() => {
    if (!pendingPayment) return '';

    // Format product name
    let productName = '';
    if (pendingPayment.type === 'monthly_group') {
      productName = 'Monthly Group Classes';
    } else if (pendingPayment.type === 'yearly_group') {
      productName = 'Yearly Group Classes';
    } else if (pendingPayment.type === 'individual_session') {
      productName = 'Individual Session(s)';
    } else {
      productName = 'payment';
    }

    // Format student names
    const studentPart = pendingPayment.studentNames ? `for ${pendingPayment.studentNames} ` : '';

    // Format amount
    const totalAmount = formatMoney(fromCents(pendingPayment.totalAmount));

    // Format discount if present
    const discountPart = pendingPayment.discountAmount
      ? ` with discount of ${formatMoney(fromCents(pendingPayment.discountAmount))}`
      : '';

    return `${studentPart}${productName} at the amount of ${totalAmount}${discountPart}`;
  }, [pendingPayment]);

  // Event handlers
  const handleCheckboxChange = (studentId: string, checked: boolean | 'indeterminate') => {
    if (mode === 'student') return; // Don't allow changes in student mode

    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (checked === true) {
        next.add(studentId);
      } else {
        next.delete(studentId);
      }
      return next;
    });
    setAppliedDiscount(null);
  };

  // Reset discount when payment option or quantity changes
  useEffect(() => {
    setAppliedDiscount(null);
  }, [paymentOption, oneOnOneQuantity, selectedStudentIds]);

  // Proactive check for pending payments
  useEffect(() => {
    // Only check if we have valid payment selection (students selected or individual quantity set)
    const hasValidSelection = (paymentOption === 'individual' && oneOnOneQuantity > 0) ||
                             ((paymentOption === 'monthly' || paymentOption === 'yearly') && selectedStudentIds.size > 0);

    if (!hasValidSelection) {
      setPendingPayment(null);
      return;
    }

    const params = new URLSearchParams();
    params.set('familyId', familyId);
    params.set('type', paymentOption === 'individual' ? 'individual_session' : paymentOption === 'yearly' ? 'yearly_group' : 'monthly_group');
    if ((paymentOption === 'monthly' || paymentOption === 'yearly') && selectedStudentIds.size > 0) {
      params.set('studentIds', Array.from(selectedStudentIds).join(','));
    }

    pendingPaymentFetcher.load(`/api/check-pending-payment?${params.toString()}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- pendingPaymentFetcher
  }, [familyId, paymentOption, selectedStudentIds, oneOnOneQuantity]);

  // Handle pending payment check response
  useEffect(() => {
    if (pendingPaymentFetcher.data && pendingPaymentFetcher.state === 'idle') {
      if (pendingPaymentFetcher.data.hasPendingPayment && pendingPaymentFetcher.data.paymentId) {
        setPendingPayment({
          paymentId: pendingPaymentFetcher.data.paymentId,
          createdAt: pendingPaymentFetcher.data.createdAt || '',
          totalAmount: pendingPaymentFetcher.data.totalAmount || 0,
          discountAmount: pendingPaymentFetcher.data.discountAmount,
          type: pendingPaymentFetcher.data.type,
          studentNames: pendingPaymentFetcher.data.studentNames
        });
      } else {
        setPendingPayment(null);
      }
    }
  }, [pendingPaymentFetcher.data, pendingPaymentFetcher.state]);

  // Form visibility control
  useEffect(() => {
    // console.log(`Payment form visibility control ${fetcher.state}`);
    if (fetcher.state === 'submitting') {
      setShowPaymentForm(false);
    } else if (fetcher.state === 'idle') {
      if (fetcher.data?.error) {
        setShowPaymentForm(true);
      } else if (!fetcher.data?.success) {
        setShowPaymentForm(true);
      } else if (fetcher.data?.success) {
        setTimeout(() => {
          setShowPaymentForm(true);
        }, 2000);
      }
    }
  }, [fetcher.state, fetcher.data?.error, fetcher.data?.success]);

// Handle success navigation - with additional debugging
  useEffect(() => {
/*
    console.log('[PaymentForm] Success navigation effect triggered:', {
      fetcherState: fetcher.state,
      fetcherData: fetcher.data,
      isIdle: fetcher.state === 'idle',
      hasData: !!fetcher.data,
      isSuccessHandled,
    });
*/

    // Only process if we have data and the fetcher is idle
    if (fetcher.state !== 'idle') {
      // console.log('[PaymentForm] Fetcher not idle, skipping processing');
      return;
    }

    if (!fetcher.data) {
      // console.log('[PaymentForm] No fetcher data available after idle state');
      return;
    }

    // console.log('[PaymentForm] Processing fetcher data:', fetcher.data);

    if (fetcher.data.success) {
      if (fetcher.data.supabasePaymentId && !isSuccessHandled) {
        setIsSuccessHandled(true);
        // console.log('[PaymentForm] Success with supabasePaymentId:', fetcher.data.supabasePaymentId);
        if (onSuccess) {
          onSuccess(fetcher.data.supabasePaymentId, fetcher.data.zeroPayment);
        } else {
          if (fetcher.data.zeroPayment) {
            // console.log('[PaymentForm] Zero payment - redirecting to family page');
            navigate('/family');
          } else {
            // console.log('[PaymentForm] Regular payment - redirecting to payment page');
            navigate(`/pay/${fetcher.data.supabasePaymentId}`);
          }
        }
      } else if (isSuccessHandled) {
        // console.log('[PaymentForm] Success already handled, skipping navigation');
      } else {
        console.warn('[PaymentForm] Success but no supabasePaymentId in response');
      }
    } else if (fetcher.data.error) {
      // Special handling for duplicate pending payment
      if (fetcher.data.error === 'DUPLICATE_PENDING_PAYMENT' && fetcher.data.duplicatePaymentId && !isDuplicateHandled) {
        setIsDuplicateHandled(true);
        const duplicateId = fetcher.data.duplicatePaymentId;
        console.log('[PaymentForm] Duplicate pending payment detected, redirecting to:', duplicateId);
        navigate(`/pay/${duplicateId}`);
      } else if (fetcher.data.error !== 'DUPLICATE_PENDING_PAYMENT') {
        console.warn('[PaymentForm] Error in response:', fetcher.data.error);
      }
    }
  }, [fetcher.state, fetcher.data, navigate, onSuccess, isSuccessHandled, isDuplicateHandled]);

  return (
    <div className={className}>
      {/* Display errors */}
      {fetcher.data?.error && fetcher.data.error !== 'DUPLICATE_PENDING_PAYMENT' && (
        <Alert variant="destructive" className="mb-4">
          <ExclamationTriangleIcon className="h-4 w-4"/>
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{fetcher.data.error}</AlertDescription>
          {fetcher.data.fieldErrors && (
            <ul className="list-disc pl-5 mt-2 text-sm">
              {Object.entries(fetcher.data.fieldErrors).map(([field, error]) => (
                error ? <li key={field}>{error}</li> : null
              ))}
            </ul>
          )}
        </Alert>
      )}

      {/* Display duplicate payment info */}
      {fetcher.data?.error === 'DUPLICATE_PENDING_PAYMENT' && fetcher.data.duplicatePaymentId && (
        <Alert className="mb-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CheckCircledIcon className="h-4 w-4 text-blue-600 dark:text-blue-400"/>
          <AlertTitle className="text-blue-800 dark:text-blue-200">Pending Payment Found</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-300">
            You already have a pending payment for this. Redirecting you to complete it...
          </AlertDescription>
        </Alert>
      )}

      {showPaymentForm ? (
        <>
          {/* Payment Option Selection */}
          <div className={paymentOptionContainerClasses}>
            <h2 className={paymentOptionHeaderClasses}>Choose Payment Option</h2>
            <RadioGroup value={paymentOption} onValueChange={(value) => setPaymentOption(value as PaymentOption)} className="space-y-2">
              {/* Monthly Payment Option */}
              {(!supportedPaymentTypes || supportedPaymentTypes.includes('monthly_subscription')) && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="monthly" id="opt-monthly" disabled={!hasEligibleStudentsForGroupPayment} tabIndex={1}/>
                  <Label htmlFor="opt-monthly" className={`text-sm ${!hasEligibleStudentsForGroupPayment ? 'cursor-not-allowed text-gray-400 dark:text-gray-500' : ''}`}>
                    Pay Monthly Group Class Fees ({formatMoney(displayMonthlyAmount)}/student)
                  </Label>
                </div>
              )}

              {/* Yearly Payment Option */}
              {(!supportedPaymentTypes || supportedPaymentTypes.includes('yearly_subscription')) && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yearly" id="opt-yearly" disabled={!hasEligibleStudentsForGroupPayment} tabIndex={2}/>
                  <Label htmlFor="opt-yearly" className={`text-sm ${!hasEligibleStudentsForGroupPayment ? 'cursor-not-allowed text-gray-400 dark:text-gray-500' : ''}`}>
                    Pay Yearly Group Class Fees ({formatMoney(displayYearlyAmount)}/student)
                  </Label>
                </div>
              )}

              {/* Individual Session Option */}
              {(!supportedPaymentTypes || supportedPaymentTypes.includes('individual_session')) && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="individual" id="opt-individual" tabIndex={3}/>
                  <Label htmlFor="opt-individual" className="text-sm">
                    Purchase Individual Session(s) ({formatMoney(displayIndividualAmount)}/session)
                  </Label>
                </div>
              )}
            </RadioGroup>

            {/* Individual Session Quantity */}
            {paymentOption === 'individual' && (
              <div className="mt-4 pl-6">
                <Label htmlFor="oneOnOneQuantity">Number of Sessions:</Label>
                <Input
                  id="oneOnOneQuantity"
                  type="number"
                  min="1"
                  value={oneOnOneQuantity}
                  onChange={(e) => setOneOnOneQuantity(parseInt(e.target.value, 10) || 1)}
                  className="mt-1 w-20"
                  tabIndex={4}
                />
                {fetcher.data?.fieldErrors?.oneOnOneQuantity && (
                  <p className="text-red-500 text-sm mt-1">{fetcher.data.fieldErrors.oneOnOneQuantity}</p>
                )}
              </div>
            )}
          </div>

          {/* Display proactive pending payment warning - positioned after selection for context */}
          {pendingPayment && (
            <Alert className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700">
              <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400"/>
              <AlertTitle className="text-yellow-800 dark:text-yellow-200">Existing Pending Payment</AlertTitle>
              <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                You have a pending payment {formatPendingPaymentMessage()} that was started recently. Would you like to complete it instead?
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => navigate(`/pay/${pendingPayment.paymentId}`)}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white"
                  >
                    Complete Existing Payment
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPendingPayment(null)}
                    className="border-yellow-600 text-yellow-700 hover:bg-yellow-50 dark:border-yellow-500 dark:text-yellow-300 dark:hover:bg-yellow-900/30"
                  >
                    Dismiss and Continue
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Student Selection (only for family mode and group payments) */}
          {!pendingPayment && mode === 'family' && (paymentOption === 'monthly' || paymentOption === 'yearly') && studentPaymentDetails.length > 0 && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
              <h2 className="text-xl font-semibold mb-4 border-b pb-2 dark:border-gray-600">
                {paymentOption === 'yearly' ? 'Select Students for Yearly Payment' : 'Select Students for Monthly Payment'}
              </h2>
              {fetcher.data?.fieldErrors?.studentIds && (
                <p className="text-red-500 text-sm mb-3">{fetcher.data.fieldErrors.studentIds}</p>
              )}

              <div className="space-y-4 mb-6">
                {studentPaymentDetails.map(detail => (
                  <div key={detail.studentId} className={`flex items-start space-x-3 p-3 rounded-md ${detail.needsPayment ? 'border border-gray-200 dark:border-gray-700' : 'opacity-70 bg-gray-50 dark:bg-gray-700/50'}`}>
                    {detail.needsPayment ? (
                      <Checkbox
                        id={`student-${detail.studentId}`}
                        checked={selectedStudentIds.has(detail.studentId)}
                        onCheckedChange={(checked) => handleCheckboxChange(detail.studentId, checked)}
                        className="mt-1"
                        tabIndex={5}
                      />
                    ) : (
                      <div className="w-4 h-4 mt-1"></div>
                    )}
                    <div className="flex-1">
                      <label htmlFor={detail.needsPayment ? `student-${detail.studentId}` : undefined} className={`font-medium ${detail.needsPayment ? 'cursor-pointer' : 'cursor-default'}`}>
                        {detail.firstName} {detail.lastName}
                      </label>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {detail.eligibility && (detail.eligibility.reason === 'Paid - Monthly' || detail.eligibility.reason === 'Paid - Yearly') && detail.eligibility.paidUntil &&
                          `Active (Paid until: ${formatDate(detail.eligibility.paidUntil, { formatString: 'MMM d, yyyy' })})`
                        }
                        {detail.eligibility?.reason === 'Trial' && 'On Free Trial'}
                        {detail.eligibility && detail.eligibility.reason === 'Expired' && detail.eligibility.paidUntil &&
                          `Expired (Paid until: ${formatDate(detail.eligibility.paidUntil, { formatString: 'MMM d, yyyy' })})`
                        }
                        {detail.eligibility && detail.eligibility.reason === 'Expired' && !detail.eligibility.paidUntil && 'Expired (No payment history)'}
                      </p>
                      {detail.needsPayment && paymentOption === 'monthly' && (
                        <p className="text-sm font-semibold text-green-700 dark:text-green-400 mt-1">
                          Next Monthly Payment: {formatMoney(detail.nextPaymentAmount)} ({detail.nextPaymentTierLabel})
                        </p>
                      )}
                      {detail.needsPayment && paymentOption === 'yearly' && (
                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 mt-1">
                          Yearly Payment: {formatMoney(displayYearlyAmount)}
                        </p>
                      )}
                      {!detail.needsPayment && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Group class payment not currently due.
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Discount Code Section */}
          {!pendingPayment && hasAvailableDiscounts && (
            <DiscountSelector
              familyId={familyId}
              studentId={selectedStudentIds.size === 1 ? Array.from(selectedStudentIds)[0] : undefined}
              enrollmentId={enrollmentId}
              subtotalAmount={currentSubtotal}
              applicableTo={paymentOption === 'individual' ? 'individual_session' : paymentOption === 'yearly' ? 'yearly_group' : 'monthly_group'}
              onDiscountApplied={setAppliedDiscount}
              disabled={fetcher.state !== 'idle'}
              showToggle={true}
              autoSelectBest={true}
            />
          )}

          {/* Total & Pricing Info Section */}
          {!pendingPayment && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
            <div className="space-y-2 border-b pb-4 mb-4 dark:border-gray-600">
              <div className="flex justify-between items-center text-md">
                <span>Subtotal:</span>
                <span>{currentSubtotalDisplay}</span>
              </div>
              {appliedDiscount && currentDiscountDisplay && (
                <div className="flex justify-between items-center text-md text-green-600 dark:text-green-400">
                  <span>Discount ({appliedDiscount.name || appliedDiscount.code}):</span>
                  <span>-{currentDiscountDisplay}</span>
                </div>
              )}
              <div className="flex justify-between items-center font-bold text-lg mt-2">
                <span>Total Due:</span>
                <span>{!isPositive(currentTotal) ? currentTotalDisplay : `${currentTotalDisplay} + Tax`}</span>
              </div>
            </div>
          </div>
          )}

          {/* Payment Form */}
          {!pendingPayment && (
          <fetcher.Form method="post" ref={formRef} id="payment-setup-form" action={actionEndpoint}>
            <AuthenticityTokenInput />
            <input type="hidden" name="familyId" value={familyId}/>
            <input type="hidden" name="paymentOption" value={paymentOption}/>
            <input type="hidden" name="studentIds" value={Array.from(selectedStudentIds).join(',')}/>
            {enrollmentId && <input type="hidden" name="enrollmentId" value={enrollmentId}/>}
            {paymentOption === 'individual' && (
              <input type="hidden" name="oneOnOneQuantity" value={oneOnOneQuantity}/>
            )}
            {appliedDiscount && (
              <>
                <input type="hidden" name="discountCodeId" value={appliedDiscount.discount_code_id}/>
                <input type="hidden" name="discountAmount" value={toCents(appliedDiscount.discount_amount)}/>
              </>
            )}

            {/* Submit Button */}
            <div className="mt-6">
              <Button
                type="submit"
                className="w-full"
                disabled={
                  fetcher.state !== 'idle' ||
                  ((paymentOption === 'monthly' || paymentOption === 'yearly') && selectedStudentIds.size === 0) ||
                  (paymentOption === 'individual' && oneOnOneQuantity <= 0)
                }
                tabIndex={8}
              >
                {fetcher.state !== 'idle' 
                  ? "Setting up payment..." 
                  : !isPositive(currentTotal)
                    ? "Proceed" 
                    : `Proceed to Pay`
                }
              </Button>
            </div>
          </fetcher.Form>
          )}
        </>
      ) : (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow text-center">
          <div className="flex items-center justify-center mb-4">
            <ReloadIcon className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Processing Payment...</h2>
          <p className="text-gray-600 dark:text-gray-400">Please wait while we set up your payment.</p>
        </div>
      )}
    </div>
  );
}
