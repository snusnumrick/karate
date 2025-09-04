import { useFetcher, useNavigate } from '@remix-run/react';
import { useRef, useState, useEffect } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { CheckCircledIcon, ExclamationTriangleIcon, ReloadIcon } from '@radix-ui/react-icons';
import { siteConfig } from '~/config/site';
import { Checkbox } from '~/components/ui/checkbox';
import { formatDate } from '~/utils/misc';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import type { AvailableDiscountCode, AvailableDiscountsResponse } from '~/routes/api.available-discounts.$familyId';
import type { DiscountValidationResult } from '~/types/discount';
import {StudentPaymentDetail} from "~/types/payment";
import { AuthenticityTokenInput } from 'remix-utils/csrf/react';

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
  paymentId?: string;
  zeroPayment?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

interface PaymentFormProps {
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
    monthlyAmount?: number;
    yearlyAmount?: number;
    individualSessionAmount?: number;
  }; // Enrollment-specific pricing that overrides default pricing
  supportedPaymentTypes?: string[];
}

export function PaymentForm({
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
}: PaymentFormProps) {
  // console.log("PaymentForm");
  // console.log("PaymentForm 1: ", familyId, studentPaymentDetails, hasAvailableDiscounts, mode, enrollmentId);
  // console.log("PaymentForm 2: ",actionEndpoint, onSuccess, initialPaymentOption, className, appearance);
  // console.log("PaymentForm 3: ",enrollmentPricing, supportedPaymentTypes);

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
  const [applyDiscount, setApplyDiscount] = useState(true);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string>('');
  const [availableDiscounts, setAvailableDiscounts] = useState<AvailableDiscountCode[]>([]);
  const [isLoadingDiscounts, setIsLoadingDiscounts] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(true);
  const [isSuccessHandled, setIsSuccessHandled] = useState(false);

  const discountsFetcher = useFetcher<AvailableDiscountsResponse>();

  // Reset success handled state on new submission
  useEffect(() => {
    if (fetcher.state === 'submitting') {
      setIsSuccessHandled(false);
    }
  }, [fetcher.state]);

  // Initialize selected students for student mode
  useEffect(() => {
    if (mode === 'student' && studentPaymentDetails[0].studentId) {
      setSelectedStudentIds(new Set([studentPaymentDetails[0].studentId]));
    }
  }, [mode, studentPaymentDetails]);

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

  // Dynamic calculation
  const calculateAmounts = () => {
    let subtotal = 0;
    if (paymentOption === 'monthly' || paymentOption === 'yearly') {
      selectedStudentIds.forEach(id => {
        const detail = studentPaymentDetails.find(d => d.studentId === id);
        if (detail) {
          let amount;
          if (paymentOption === 'yearly') {
            // Use enrollment-specific yearly pricing if available, otherwise fall back to siteConfig
            amount = enrollmentPricing?.yearlyAmount ?? siteConfig.pricing.yearly;
          } else {
            // For monthly, use enrollment-specific pricing if available, otherwise use detail.nextPaymentAmount
            amount = enrollmentPricing?.monthlyAmount ?? detail.nextPaymentAmount;
          }
          subtotal += amount * 100;
        }
      });
    } else if (paymentOption === 'individual') {
      // Use enrollment-specific individual session pricing if available, otherwise fall back to siteConfig
      const sessionPrice = enrollmentPricing?.individualSessionAmount ?? siteConfig.pricing.oneOnOneSession;
      subtotal = sessionPrice * oneOnOneQuantity * 100;
    }

    const discountAmount = appliedDiscount?.discount_amount || 0;
    const discountedSubtotal = Math.max(0, subtotal - discountAmount);
    const total = discountedSubtotal;

    return { subtotal, discountAmount, total };
  };

  // Helper functions
  const formatCurrency = (amountInCents: number): string => {
    const amount = amountInCents / 100;
    const formatted = amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2);
    return `$${formatted}`;
  };

  const calculatePercentageSavings = (discount: AvailableDiscountCode, subtotalInCents: number): string => {
    if (discount.discount_type === 'percentage') {
      const savingsAmount = (subtotalInCents * discount.discount_value) / 100;
      return formatCurrency(savingsAmount);
    }
    return formatCurrency(discount.discount_value * 100);
  };

  const { subtotal: currentSubtotalInCents, discountAmount: currentDiscountAmountInCents, total: currentTotalInCents } = calculateAmounts();
  const currentSubtotalDisplay = formatCurrency(currentSubtotalInCents);
  const currentDiscountDisplay = appliedDiscount ? formatCurrency(currentDiscountAmountInCents) : null;
  const currentTotalDisplay = formatCurrency(currentTotalInCents);

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

  // Reset discount when payment option changes
  useEffect(() => {
    setAppliedDiscount(null);
  }, [paymentOption]);

  // Reset discount when one-on-one quantity changes
  useEffect(() => {
    if (paymentOption === 'individual') {
      setAppliedDiscount(null);
    }
  }, [oneOnOneQuantity, paymentOption]);

  // Fetch available discounts
  useEffect(() => {
    if (applyDiscount && hasAvailableDiscounts) {
      // Calculate subtotal without applied discount for fetching available discounts
      let baseSubtotal = 0;
      if (paymentOption === 'monthly' || paymentOption === 'yearly') {
        selectedStudentIds.forEach(id => {
          const detail = studentPaymentDetails.find(d => d.studentId === id);
          if (detail) {
            let amount;
            if (paymentOption === 'yearly') {
              amount = enrollmentPricing?.yearlyAmount ?? siteConfig.pricing.yearly;
            } else {
              amount = enrollmentPricing?.monthlyAmount ?? detail.nextPaymentAmount;
            }
            baseSubtotal += amount * 100;
          }
        });
      } else if (paymentOption === 'individual') {
        const sessionPrice = enrollmentPricing?.individualSessionAmount ?? siteConfig.pricing.oneOnOneSession;
        baseSubtotal = sessionPrice * oneOnOneQuantity * 100;
      }

      if (baseSubtotal > 0) {
        setIsLoadingDiscounts(true);
        const params = new URLSearchParams();
        if (selectedStudentIds.size === 1) {
          params.set('studentId', Array.from(selectedStudentIds)[0]);
        }
        const applicableTo = paymentOption === 'individual' ? 'individual_session' : paymentOption === 'yearly' ? 'yearly_group' : 'monthly_group';
        params.set('applicableTo', applicableTo);
        params.set('subtotalAmount', baseSubtotal.toString());
        if (enrollmentId) {
          params.set('enrollmentId', enrollmentId);
        }

        discountsFetcher.load(`/api/available-discounts/${familyId}?${params.toString()}`);
      }
    } else if (!applyDiscount) {
      setAvailableDiscounts([]);
      setSelectedDiscountId('');
      setAppliedDiscount(null);
    }
  // }, [applyDiscount, hasAvailableDiscounts, familyId, selectedStudentIds, paymentOption, oneOnOneQuantity, studentPaymentDetails, enrollmentPricing, enrollmentId]);
  // Note: These dependencies are intentionally omitted to prevent infinite loop as they are recreated on every render.
  // The effect only needs to run when discount loading params change.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- discountsFetcher, enrollmentId, enrollmentPricing?.individualSessionAmount, enrollmentPricing?.monthlyAmount, enrollmentPricing?.yearlyAmount, studentPaymentDetails
  }, [applyDiscount, hasAvailableDiscounts, familyId, selectedStudentIds, paymentOption, oneOnOneQuantity]);

  // Handle discounts fetcher response
  useEffect(() => {
    if (discountsFetcher.data && discountsFetcher.state === 'idle') {
      const discounts = discountsFetcher.data.discounts || [];
      const sortedDiscounts = discounts.sort((a, b) => {
        const aValue = a.discount_type === 'percentage' ? a.discount_value : a.discount_value;
        const bValue = b.discount_type === 'percentage' ? b.discount_value : b.discount_value;
        return bValue - aValue;
      });
      setAvailableDiscounts(sortedDiscounts);
      if (sortedDiscounts.length > 0) {
        setSelectedDiscountId(sortedDiscounts[0].id);
      }
      setIsLoadingDiscounts(false);
    }
  }, [discountsFetcher.data, discountsFetcher.state]);

  // Validate discount when selected
  useEffect(() => {
    // console.log('Validate discount');
    // console.log('Validate discount:', selectedDiscountId, applyDiscount, familyId, selectedStudentIds, paymentOption, oneOnOneQuantity, studentPaymentDetails, enrollmentPricing);
    if (selectedDiscountId && applyDiscount) {
      const selectedDiscount = availableDiscounts.find(d => d.id === selectedDiscountId);
      if (selectedDiscount) {
        const validateDiscount = async () => {
          try {
            // Calculate base subtotal for validation (without applied discount)
            let baseSubtotal = 0;
            if (paymentOption === 'monthly' || paymentOption === 'yearly') {
              selectedStudentIds.forEach(id => {
              const detail = studentPaymentDetails.find(d => d.studentId === id);
                if (detail) {
                  let amount;
                  if (paymentOption === 'yearly') {
                    amount = enrollmentPricing?.yearlyAmount ?? siteConfig.pricing.yearly;
                  } else {
                    amount = enrollmentPricing?.monthlyAmount ?? detail.nextPaymentAmount;
                  }
                  baseSubtotal += amount * 100;
                }
              });
            } else if (paymentOption === 'individual') {
              const sessionPrice = enrollmentPricing?.individualSessionAmount ?? siteConfig.pricing.oneOnOneSession;
              baseSubtotal = sessionPrice * oneOnOneQuantity * 100;
            }

            const response = await fetch('/api/discount-codes/validate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                code: selectedDiscount.code,
                family_id: familyId,
                student_id: selectedStudentIds.size === 1 ? Array.from(selectedStudentIds)[0] : '',
                subtotal_amount: baseSubtotal,
                applicable_to: paymentOption === 'individual' ? 'individual_session' : paymentOption === 'yearly' ? 'yearly_group' : 'monthly_group'
              })
            });

            if (response.ok) {
              const data = await response.json();
              if (data.is_valid) {
                setAppliedDiscount(data);
              } else {
                setAppliedDiscount(null);
              }
            } else {
              setAppliedDiscount(null);
            }
          } catch (error) {
            console.error('Error validating discount:', error);
            setAppliedDiscount(null);
          }
        };

        validateDiscount();
      }
    }
    // Note: These dependencies are intentionally omitted to prevent infinite loop as they are recreated on every render.
    // The validation only needs to run when discount selection or payment params change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- availableDiscounts, enrollmentPricing, studentPaymentDetails
  }, [selectedDiscountId, applyDiscount, familyId, selectedStudentIds, paymentOption, oneOnOneQuantity]);

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
      if (fetcher.data.paymentId && !isSuccessHandled) {
        setIsSuccessHandled(true);
        // console.log('[PaymentForm] Success with paymentId:', fetcher.data.paymentId);
        if (onSuccess) {
          onSuccess(fetcher.data.paymentId, fetcher.data.zeroPayment);
        } else {
          if (fetcher.data.zeroPayment) {
            // console.log('[PaymentForm] Zero payment - redirecting to family page');
            navigate('/family');
          } else {
            // console.log('[PaymentForm] Regular payment - redirecting to payment page');
            navigate(`/pay/${fetcher.data.paymentId}`);
          }
        }
      } else if (isSuccessHandled) {
        // console.log('[PaymentForm] Success already handled, skipping navigation');
      } else {
        console.warn('[PaymentForm] Success but no paymentId in response');
      }
    } else if (fetcher.data.error) {
      console.warn('[PaymentForm] Error in response:', fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data, navigate, onSuccess, isSuccessHandled]);

  return (
    <div className={className}>
      {/* Display errors */}
      {fetcher.data?.error && (
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
                    Pay Monthly Group Class Fees ({siteConfig.pricing.currency}{enrollmentPricing?.monthlyAmount ?? siteConfig.pricing.monthly}/student)
                  </Label>
                </div>
              )}

              {/* Yearly Payment Option */}
              {(!supportedPaymentTypes || supportedPaymentTypes.includes('yearly_subscription')) && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yearly" id="opt-yearly" disabled={!hasEligibleStudentsForGroupPayment} tabIndex={2}/>
                  <Label htmlFor="opt-yearly" className={`text-sm ${!hasEligibleStudentsForGroupPayment ? 'cursor-not-allowed text-gray-400 dark:text-gray-500' : ''}`}>
                    Pay Yearly Group Class Fees ({siteConfig.pricing.currency}{enrollmentPricing?.yearlyAmount ?? siteConfig.pricing.yearly}/student)
                  </Label>
                </div>
              )}

              {/* Individual Session Option */}
              {(!supportedPaymentTypes || supportedPaymentTypes.includes('individual_session')) && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="individual" id="opt-individual" tabIndex={3}/>
                  <Label htmlFor="opt-individual" className="text-sm">
                    Purchase Individual Session(s) ({siteConfig.pricing.currency}{enrollmentPricing?.individualSessionAmount ?? siteConfig.pricing.oneOnOneSession}/session)
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

          {/* Student Selection (only for family mode and group payments) */}
          {mode === 'family' && (paymentOption === 'monthly' || paymentOption === 'yearly') && studentPaymentDetails.length > 0 && (
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
                          Next Monthly Payment: {formatCurrency(detail.nextPaymentAmount * 100)} ({detail.nextPaymentTierLabel})
                        </p>
                      )}
                      {detail.needsPayment && paymentOption === 'yearly' && (
                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 mt-1">
                          Yearly Payment: {formatCurrency((enrollmentPricing?.yearlyAmount ?? siteConfig.pricing.yearly) * 100)}
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
          {currentSubtotalInCents > 0 && hasAvailableDiscounts && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
              <div className="flex items-center space-x-2 mb-4">
                <Checkbox
                  id="apply-discount"
                  checked={applyDiscount}
                  onCheckedChange={(checked) => setApplyDiscount(checked === true)}
                  disabled={fetcher.state !== 'idle'}
                  tabIndex={6}
                />
                <Label htmlFor="apply-discount" className="text-lg font-semibold">
                  Apply Discount Code
                </Label>
              </div>

              {applyDiscount && (
                <div className="space-y-4">
                  {isLoadingDiscounts ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <ReloadIcon className="h-4 w-4 animate-spin" />
                      Loading available discounts...
                    </div>
                  ) : availableDiscounts.length > 0 ? (
                    <div>
                      <Label htmlFor="discount-select" className="text-sm font-medium mb-2 block">
                        Select Discount Code
                      </Label>
                      <Select value={selectedDiscountId} onValueChange={setSelectedDiscountId} disabled={fetcher.state !== 'idle'}>
                        <SelectTrigger className="w-full" tabIndex={7}>
                          <SelectValue placeholder="Choose a discount code" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableDiscounts.map((discount) => {
                            const savingsDisplay = calculatePercentageSavings(discount, currentSubtotalInCents);
                            const displayText = discount.discount_type === 'percentage' 
                              ? `${discount.code} - ${discount.discount_value}% off (Save ${savingsDisplay})`
                              : `${discount.code} - ${savingsDisplay} off`;
                            return (
                              <SelectItem key={discount.id} value={discount.id}>
                                {displayText}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>

                      {appliedDiscount && (
                        <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 mt-4">
                          <CheckCircledIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <AlertDescription className="text-green-800 dark:text-green-200">
                            <strong>Discount Applied: {appliedDiscount.name || appliedDiscount.code}</strong>
                            <div className="text-sm mt-1">
                              Discount: {formatCurrency(appliedDiscount.discount_amount * 100)}
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No discount codes are currently available for this payment.
                    </p>
                  )}

                  {discountsFetcher.data?.error && (
                    <Alert variant="destructive">
                      <ExclamationTriangleIcon className="h-4 w-4" />
                      <AlertDescription>
                        {discountsFetcher.data.error}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Total & Pricing Info Section */}
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
                <span>{currentTotalInCents <= 0 ? currentTotalDisplay : `${currentTotalDisplay} + Tax`}</span>
              </div>
            </div>
          </div>

          {/* Payment Form */}
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
                <input type="hidden" name="discountAmount" value={appliedDiscount.discount_amount}/>
              </>
            )}
          </fetcher.Form>

          {/* Submit Button */}
          <div className="mt-6">
            <Button
              type="submit"
              form="payment-setup-form"
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
                : currentTotalInCents <= 0 
                  ? "Proceed" 
                  : `Proceed to Pay`
              }
            </Button>
          </div>
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
