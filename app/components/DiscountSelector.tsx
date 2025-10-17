import { useState, useEffect, useCallback } from 'react';
import { useFetcher } from '@remix-run/react';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { CheckCircledIcon, ExclamationTriangleIcon, ReloadIcon } from '@radix-ui/react-icons';
import { Checkbox } from '~/components/ui/checkbox';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import type { AvailableDiscountCode, AvailableDiscountsResponse } from '~/routes/api.available-discounts.$familyId';
import type { DiscountValidationResult, PaymentTypeEnum } from '~/types/discount';
import {
  formatMoney,
  isPositive,
  serializeMoney,
  toMoney,
  percentageOf,
  compareMoney,
  type Money
} from '~/utils/money';

interface DiscountSelectorProps {
  familyId: string;
  studentId?: string;
  enrollmentId?: string;
  subtotalAmount: Money;
  applicableTo: PaymentTypeEnum;
  onDiscountApplied: (discount: DiscountValidationResult | null) => void;
  disabled?: boolean;
  showToggle?: boolean; // Show enable/disable checkbox (default true)
  autoSelectBest?: boolean; // Auto-select best discount (default true)
}

export function DiscountSelector({
  familyId,
  studentId,
  enrollmentId,
  subtotalAmount,
  applicableTo,
  onDiscountApplied,
  disabled = false,
  showToggle = true,
  autoSelectBest = true
}: DiscountSelectorProps) {
  const [applyDiscount, setApplyDiscount] = useState(true);
  const [selectedDiscountId, setSelectedDiscountId] = useState<string>('');
  const [availableDiscounts, setAvailableDiscounts] = useState<AvailableDiscountCode[]>([]);
  const [isLoadingDiscounts, setIsLoadingDiscounts] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountValidationResult | null>(null);

  const discountsFetcher = useFetcher<AvailableDiscountsResponse>();

  // Helper function to calculate percentage savings display
  const calculatePercentageSavings = useCallback((discount: AvailableDiscountCode, subtotal: Money): string => {
    if (discount.discount_type === 'percentage' && typeof discount.discount_value === 'number') {
      const savingsAmount = percentageOf(subtotal, discount.discount_value);
      return formatMoney(savingsAmount);
    }
    const dv = discount.discount_value as unknown;
    const discountMoney: Money = toMoney(dv);
    return formatMoney(discountMoney);
  }, []);

  // Fetch available discounts when conditions change
  useEffect(() => {
    if (applyDiscount && isPositive(subtotalAmount)) {
      setIsLoadingDiscounts(true);
      const params = new URLSearchParams();
      if (studentId) {
        params.set('studentId', studentId);
      }
      params.set('applicableTo', applicableTo);
      params.set('subtotalAmount', JSON.stringify(serializeMoney(subtotalAmount)));
      if (enrollmentId) {
        params.set('enrollmentId', enrollmentId);
      }

      discountsFetcher.load(`/api/available-discounts/${familyId}?${params.toString()}`);
    } else if (!applyDiscount) {
      setAvailableDiscounts([]);
      setSelectedDiscountId('');
      setAppliedDiscount(null);
      onDiscountApplied(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyDiscount, familyId, studentId, enrollmentId, applicableTo]);

  // Handle discounts fetcher response and sort by value
  useEffect(() => {
    if (discountsFetcher.data && discountsFetcher.state === 'idle') {
      const discounts = discountsFetcher.data.discounts || [];

      // Sort discounts by value (best first)
      const sortedDiscounts = discounts.sort((a, b) => {
        let aValue: Money;
        let bValue: Money;

        if (a.discount_type === 'percentage') {
          const percentageValue = typeof a.discount_value === 'number' ? a.discount_value : 0;
          aValue = percentageOf(subtotalAmount, percentageValue);
        } else {
          const adv = a.discount_value as unknown;
          aValue = toMoney(adv);
        }

        if (b.discount_type === 'percentage') {
          const percentageValue = typeof b.discount_value === 'number' ? b.discount_value : 0;
          bValue = percentageOf(subtotalAmount, percentageValue);
        } else {
          const bdv = b.discount_value as unknown;
          bValue = toMoney(bdv);
        }

        return compareMoney(bValue, aValue); // Sort descending (best first)
      });

      setAvailableDiscounts(sortedDiscounts);

      // Auto-select best discount if enabled
      if (autoSelectBest && sortedDiscounts.length > 0) {
        setSelectedDiscountId(sortedDiscounts[0].id);
      }

      setIsLoadingDiscounts(false);
    }
  }, [discountsFetcher.data, discountsFetcher.state, subtotalAmount, autoSelectBest]);

  // Validate discount when selected
  useEffect(() => {
    if (selectedDiscountId && applyDiscount) {
      const selectedDiscount = availableDiscounts.find(d => d.id === selectedDiscountId);
      if (selectedDiscount) {
        const validateDiscount = async () => {
          try {
            const response = await fetch('/api/discount-codes/validate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                code: selectedDiscount.code,
                family_id: familyId,
                student_id: studentId || '',
                subtotal_amount: subtotalAmount,
                applicable_to: applicableTo
              })
            });

            if (response.ok) {
              const data = await response.json();
              if (data.is_valid) {
                const validatedDiscount = {
                  ...data,
                  discount_amount: toMoney(data.discount_amount as unknown),
                };
                setAppliedDiscount(validatedDiscount);
                onDiscountApplied(validatedDiscount);
              } else {
                setAppliedDiscount(null);
                onDiscountApplied(null);
              }
            } else {
              setAppliedDiscount(null);
              onDiscountApplied(null);
            }
          } catch (error) {
            console.error('Error validating discount:', error);
            setAppliedDiscount(null);
            onDiscountApplied(null);
          }
        };

        validateDiscount();
      }
    } else {
      setAppliedDiscount(null);
      onDiscountApplied(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDiscountId, applyDiscount, familyId, studentId, applicableTo]);

  // Reset when disabled externally
  useEffect(() => {
    if (disabled && appliedDiscount) {
      setAppliedDiscount(null);
      onDiscountApplied(null);
    }
  }, [disabled, appliedDiscount, onDiscountApplied]);

  // Don't show anything if subtotal is zero or negative
  if (!isPositive(subtotalAmount)) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
      {showToggle ? (
        <div className="flex items-center space-x-2 mb-4">
          <Checkbox
            id="apply-discount"
            checked={applyDiscount}
            onCheckedChange={(checked) => setApplyDiscount(checked === true)}
            disabled={disabled}
          />
          <Label htmlFor="apply-discount" className="text-lg font-semibold">
            Apply Discount Code
          </Label>
        </div>
      ) : (
        <h3 className="text-lg font-semibold mb-4">Discount Code</h3>
      )}

      {(!showToggle || applyDiscount) && (
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
              <Select
                value={selectedDiscountId}
                onValueChange={setSelectedDiscountId}
                disabled={disabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a discount code" />
                </SelectTrigger>
                <SelectContent>
                  {availableDiscounts.map((discount) => {
                    const savingsDisplay = calculatePercentageSavings(discount, subtotalAmount);
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
                      Discount: {formatMoney(appliedDiscount.discount_amount)}
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
  );
}
