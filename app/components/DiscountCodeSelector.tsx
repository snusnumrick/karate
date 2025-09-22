import { useState, useEffect } from 'react';
import { useFetcher } from '@remix-run/react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { formatMoney, serializeMoney, type Money } from '~/utils/money';
import { Label } from '~/components/ui/label';
import { Alert, AlertDescription } from '~/components/ui/alert';
import { CheckCircledIcon, ExclamationTriangleIcon, ReloadIcon } from '@radix-ui/react-icons';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import type { DiscountValidationResult, PaymentTypeEnum } from '~/types/discount';
import type { AvailableDiscountCode, AvailableDiscountsResponse } from '~/routes/api.available-discounts.$familyId';

interface DiscountCodeSelectorProps {
  familyId: string;
  studentId?: string;
  subtotalAmount: Money;
  applicableTo: PaymentTypeEnum;
  onDiscountApplied: (discount: DiscountValidationResult | null) => void;
  disabled?: boolean;
}

export function DiscountCodeSelector({
  familyId,
  studentId,
  subtotalAmount,
  applicableTo,
  onDiscountApplied,
  disabled = false
}: DiscountCodeSelectorProps) {
  const [discountCode, setDiscountCode] = useState('');
  const [selectedDiscountId, setSelectedDiscountId] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountValidationResult | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [availableDiscounts, setAvailableDiscounts] = useState<AvailableDiscountCode[]>([]);
  const [isLoadingDiscounts, setIsLoadingDiscounts] = useState(true);
  const discountsFetcher = useFetcher<AvailableDiscountsResponse>();
  const [isValidating, setIsValidating] = useState(false);

  // Fetch available discounts on component mount
  useEffect(() => {
    const params = new URLSearchParams();
    if (studentId) params.set('studentId', studentId);
    params.set('applicableTo', applicableTo);
    params.set('subtotalAmount', JSON.stringify(serializeMoney(subtotalAmount)));
    
    discountsFetcher.load(`/api/available-discounts/${familyId}?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, studentId, applicableTo, subtotalAmount]); // Intentionally excluding discountsFetcher to prevent infinite loop

  // Handle discounts fetcher response
  useEffect(() => {
    if (discountsFetcher.data && discountsFetcher.state === 'idle') {
      setAvailableDiscounts(discountsFetcher.data.discounts || []);
      setIsLoadingDiscounts(false);
    }
  }, [discountsFetcher.data, discountsFetcher.state]);

  const handleValidateDiscount = async (code?: string) => {
    const codeToValidate = code || discountCode.trim();
    if (!codeToValidate) return;

    setIsValidating(true);
    try {
      const response = await fetch('/api/discount-codes/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: codeToValidate.toUpperCase(),
          family_id: familyId,
          student_id: studentId || '',
          subtotal_amount: serializeMoney(subtotalAmount),
          applicable_to: applicableTo
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.is_valid) {
          setAppliedDiscount(data);
          onDiscountApplied(data);
        }
      } else {
        console.error('Failed to validate discount:', response.statusText);
      }
    } catch (error) {
      console.error('Error validating discount:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const handleSelectDiscount = (discountId: string) => {
    setSelectedDiscountId(discountId);
    const selectedDiscount = availableDiscounts.find(d => d.id === discountId);
    if (selectedDiscount) {
      handleValidateDiscount(selectedDiscount.code);
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode('');
    setSelectedDiscountId('');
    onDiscountApplied(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleValidateDiscount();
    }
  };

  // Validation response is now handled directly in handleValidateDiscount



  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
      <h3 className="text-lg font-semibold mb-4 border-b pb-2 dark:border-gray-600">
        Discount Code
      </h3>

      {!appliedDiscount ? (
        <div className="space-y-4">
          {/* Loading state */}
          {isLoadingDiscounts && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <ReloadIcon className="h-4 w-4 animate-spin" />
              Loading available discounts...
            </div>
          )}

          {/* Available discounts list */}
          {!isLoadingDiscounts && availableDiscounts.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Available Discount Codes
              </Label>
              <RadioGroup
                value={selectedDiscountId}
                onValueChange={handleSelectDiscount}
                disabled={disabled || isValidating}
                className="space-y-2"
              >
                {availableDiscounts.map((discount) => (
                  <div key={discount.id} className="flex items-center space-x-2 p-3 border rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 dark:border-gray-600">
                    <RadioGroupItem value={discount.id} id={discount.id} />
                    <Label htmlFor={discount.id} className="flex-1 cursor-pointer text-sm">
                      {discount.formatted_display}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Manual entry option */}
          {!isLoadingDiscounts && (
            <div className="border-t pt-4 dark:border-gray-600">
              {!showManualEntry ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowManualEntry(true)}
                  disabled={disabled}
                  className="text-sm"
                >
                  Enter a different discount code
                </Button>
              ) : (
                <div>
                  <Label htmlFor="discount-code" className="text-sm font-medium">
                    Enter discount code manually
                  </Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="discount-code"
                      type="text"
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                      onKeyPress={handleKeyPress}
                      placeholder="Enter code"
                      disabled={disabled || isValidating}
                      className="flex-1"
                      maxLength={20}
                    />
                    <Button
                      type="button"
                      onClick={() => handleValidateDiscount()}
                      disabled={disabled || isValidating || !discountCode.trim()}
                      variant="outline"
                    >
                      {isValidating ? 'Checking...' : 'Apply'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowManualEntry(false);
                        setDiscountCode('');
                      }}
                      disabled={disabled || isValidating}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Validation errors are now handled in the async function */}

          {/* Show discounts fetch error */}
          {discountsFetcher.data?.error && (
            <Alert variant="destructive">
              <ExclamationTriangleIcon className="h-4 w-4" />
              <AlertDescription>
                {discountsFetcher.data.error}
              </AlertDescription>
            </Alert>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Show applied discount */}
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <CheckCircledIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <div className="flex justify-between items-center">
                <div>
                  <strong>Discount Applied: {discountCode}</strong>
                  <div className="text-sm mt-1">
                    Discount: {formatMoney(appliedDiscount.discount_amount)}
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleRemoveDiscount}
                  variant="ghost"
                  size="sm"
                  className="text-green-700 hover:text-green-900 dark:text-green-300 dark:hover:text-green-100"
                >
                  Remove
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Help text */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        {!isLoadingDiscounts && availableDiscounts.length === 0 && !showManualEntry && (
          <p>No discount codes are currently available for this payment.</p>
        )}
        <p>Discount codes can be used for {applicableTo.replace('_', ' ')} payments. Only one discount code can be applied per payment.</p>
      </div>
    </div>
  );
}