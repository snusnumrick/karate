import type { InvoiceItemType, CreateInvoiceLineItemData, TaxRate } from "~/types/invoice";
import { formatDate } from "~/utils/misc";
import {
    multiplyMoney,
    addMoney,
    subtractMoney,
    getAmount,
    Money,
    percentageOf,
    negativeMoney, ZERO_MONEY, ratioMoney, isPositive
} from "~/utils/money";

/**
 * Get item type display label
 */
export function getItemTypeLabel(itemType: InvoiceItemType): string {
  const labels: Record<InvoiceItemType, string> = {
    class_enrollment: 'Class Enrollment',
    individual_session: 'Individual Session',
    product: 'Product',
    fee: 'Fee',
    discount: 'Discount',
    other: 'Other'
  };
  
  return labels[itemType] || itemType;
}

/**
 * Get available item types for selection
 */
export function getAvailableItemTypes(): Array<{ value: InvoiceItemType; label: string }> {
  return [
    { value: 'class_enrollment', label: 'Class Enrollment' },
    { value: 'individual_session', label: 'Individual Session' },
    { value: 'product', label: 'Product' },
    { value: 'fee', label: 'Fee' },
    { value: 'discount', label: 'Discount' },
    { value: 'other', label: 'Other' }
  ];
}

/**
 * Create a new empty line item
 */
export function createEmptyLineItem(): CreateInvoiceLineItemData {
  return {
    item_type: 'other',
    description: '',
    quantity: 1,
    unit_price: ZERO_MONEY,
    tax_rate: 0,
    discount_rate: 0
  };
}

/**
 * Validate line item data
 */
export function validateLineItem(item: CreateInvoiceLineItemData): string[] {
  const errors: string[] = [];
  
  if (!item.description?.trim()) {
    errors.push('Description is required');
  }
  
  if (item.quantity <= 0) {
    errors.push('Quantity must be greater than 0');
  }
  
  if (getAmount(item.unit_price) < 0) {
    errors.push('Unit price cannot be negative');
  }
  
  if (item.tax_rate && (item.tax_rate < 0 || item.tax_rate > 100)) {
    errors.push('Tax rate must be between 0 and 100');
  }
  
  if (item.discount_rate && (item.discount_rate < 0 || item.discount_rate > 100)) {
    errors.push('Discount rate must be between 0 and 100');
  }
  
  return errors;
}

/**
 * Create line item from class enrollment
 */
export function createLineItemFromEnrollment(
  enrollmentId: string,
  className: string,
  programName: string,
  monthlyFee: Money,
  servicePeriodStart?: string,
  servicePeriodEnd?: string
): CreateInvoiceLineItemData {
  return {
    item_type: 'class_enrollment',
    description: `${programName} - ${className}`,
    quantity: 1,
    unit_price: monthlyFee,
    tax_rate: 0,
    discount_rate: 0,
    enrollment_id: enrollmentId,
    service_period_start: servicePeriodStart,
    service_period_end: servicePeriodEnd
  };
}

/**
 * Create line item from product
 */
export function createLineItemFromProduct(
  productId: string,
  productName: string,
  price: Money,
  quantity: number = 1
): CreateInvoiceLineItemData {
  return {
    item_type: 'product',
    description: productName,
    quantity,
    unit_price: price,
    tax_rate: 0,
    discount_rate: 0,
    product_id: productId
  };
}

/**
 * Create line item for fee
 */
export function createFeeLineItem(
  description: string,
  amount: Money
): CreateInvoiceLineItemData {
  return {
    item_type: 'fee',
    description,
    quantity: 1,
    unit_price: amount,
    tax_rate: 0,
    discount_rate: 0
  };
}

/**
 * Create line item for discount
 */
export function createDiscountLineItem(
  description: string,
  discountAmount: Money
): CreateInvoiceLineItemData {
  return {
    item_type: 'discount',
    description,
    quantity: 1,
    unit_price: negativeMoney(discountAmount), // Ensure negative for discount
    tax_rate: 0,
    discount_rate: 0
  };
}

/**
 * Duplicate a line item
 */
export function duplicateLineItem(item: CreateInvoiceLineItemData): CreateInvoiceLineItemData {
  return {
    ...item,
    // Remove IDs to create a new item
    enrollment_id: undefined,
    product_id: undefined
  };
}

/**
 * Calculate line item subtotal (before tax and discount)
 */
export function calculateLineItemSubtotal(item: CreateInvoiceLineItemData): Money {
  return multiplyMoney(item.unit_price, item.quantity);
}

/**
 * Calculate line item discount amount
 */
export function calculateLineItemDiscount(item: CreateInvoiceLineItemData): Money {
  const subtotal = calculateLineItemSubtotal(item);
  const discountRate = item.discount_rate || 0;
  return percentageOf(subtotal, discountRate);
}

/**
 * Calculate line item tax amount with multiple tax rates
 */
export function calculateLineItemTaxWithRates(
  quantity: number,
  unitPrice: Money,
  taxRateIds: string[],
  taxRates: TaxRate[],
  discountRate: number = 0
): Money {
  if (!taxRateIds || taxRateIds.length === 0) {
    return ZERO_MONEY;
  }

  const subtotal = multiplyMoney(unitPrice, quantity);
  // discountRate is stored as percentage (e.g., 10 for 10%), convert to decimal
  const discountAmount = percentageOf(subtotal, discountRate);
  const taxableAmount = subtractMoney(subtotal, discountAmount);
  
  // Calculate total tax from all applicable tax rates
  const totalTaxRate = taxRateIds.reduce((total, taxRateId) => {
    const taxRate = taxRates.find(rate => rate.id === taxRateId);
    return total + (taxRate?.rate || 0);
  }, 0);
  
  return multiplyMoney(taxableAmount, totalTaxRate);
}

/**
 * Get tax breakdown for a line item with multiple tax rates
 */
export function getLineItemTaxBreakdown(item: CreateInvoiceLineItemData, taxRates: TaxRate[]): Array<{ taxRate: TaxRate; amount: Money }> {
  if (!item.tax_rate_ids || item.tax_rate_ids.length === 0) {
    return [];
  }

  const subtotal = calculateLineItemSubtotal(item);
  const discount = calculateLineItemDiscount(item);
  const taxableAmount = subtractMoney(subtotal, discount);
  
  return item.tax_rate_ids.map(taxRateId => {
     const taxRate = taxRates.find(rate => rate.id === taxRateId);
     if (!taxRate) {
       const unknownTaxRate: TaxRate = {
         id: taxRateId,
         name: 'Unknown',
         rate: 0,
         is_active: false,
         created_at: new Date().toISOString(),
         updated_at: new Date().toISOString()
       };
       return { taxRate: unknownTaxRate, amount: ZERO_MONEY}
     }
     
     const amount = multiplyMoney(taxableAmount, taxRate.rate);
     return { taxRate, amount };
   });
}



/**
 * Calculate line item total with multiple tax rates
 */
export function calculateLineItemTotalWithRates(item: CreateInvoiceLineItemData, taxRates: TaxRate[]): Money {
  const subtotal = calculateLineItemSubtotal(item);
  const discount = calculateLineItemDiscount(item);
  const tax = calculateLineItemTaxWithRates(
    item.quantity,
    item.unit_price,
    item.tax_rate_ids || [],
    taxRates,
    item.discount_rate || 0
  );
  return addMoney(subtractMoney( subtotal, discount), tax);
}

/**
 * Format service period for display
 */
export function formatServicePeriod(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) {
    return '';
  }
  
  if (startDate && endDate) {
    const start = formatDate(startDate, { formatString: 'MMM d, yyyy' });
    const end = formatDate(endDate, { formatString: 'MMM d, yyyy' });
    return `${start} - ${end}`;
  }
  
  if (startDate) {
    return `From ${formatDate(startDate, { formatString: 'MMM d, yyyy' })}`;
  }
  
  if (endDate) {
    return `Until ${formatDate(endDate, { formatString: 'MMM d, yyyy' })}`;
  }
  
  return '';
}

/**
 * Get default service period for current month
 */
export function getDefaultServicePeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

/**
 * Sort line items by type and description
 */
export function sortLineItems(items: CreateInvoiceLineItemData[]): CreateInvoiceLineItemData[] {
  return [...items].sort((a, b) => {
    // First sort by type
    if (a.item_type !== b.item_type) {
      return a.item_type.localeCompare(b.item_type);
    }
    // Then by description
    return a.description.localeCompare(b.description);
  });
}

/**
 * Calculate proportional tax breakdown for invoice payments
 * Distributes payment amount proportionally across all tax rates based on invoice totals
 */
export function calculateInvoicePaymentTaxBreakdown(
  paymentAmount: Money,
  invoiceTotalAmount: Money,
  invoiceTaxAmount: Money,
  lineItems: Array<{
    id: string;
    taxes?: Array<{
      tax_rate_id: string;
      tax_amount: Money;
      tax_name_snapshot: string;
      tax_rate_snapshot: number;
      tax_description_snapshot?: string;
    }>;
  }>
): Array<{
  tax_rate_id: string;
  tax_amount: Money;
  tax_name_snapshot: string;
  tax_rate_snapshot: number;
  tax_description_snapshot?: string;
}> {
  if (!(paymentAmount.isPositive() && invoiceTotalAmount.isPositive() && invoiceTaxAmount.isPositive())) {
    return [];
  }

  // Calculate payment proportion
  const paymentProportion =ratioMoney(paymentAmount, invoiceTotalAmount);
  
  // Aggregate all tax amounts by tax rate ID
  const taxAggregation = new Map<string, {
    total_amount: Money;
    tax_name_snapshot: string;
    tax_rate_snapshot: number;
    tax_description_snapshot?: string;
  }>();

  lineItems.forEach(item => {
    if (item.taxes) {
      item.taxes.forEach(tax => {
        const existing = taxAggregation.get(tax.tax_rate_id);
        if (existing) {
          existing.total_amount = addMoney(existing.total_amount, tax.tax_amount);
        } else {
          taxAggregation.set(tax.tax_rate_id, {
            total_amount: tax.tax_amount,
            tax_name_snapshot: tax.tax_name_snapshot,
            tax_rate_snapshot: tax.tax_rate_snapshot,
            tax_description_snapshot: tax.tax_description_snapshot
          });
        }
      });
    }
  });

  // Calculate proportional tax amounts for this payment
  const paymentTaxBreakdown: Array<{
    tax_rate_id: string;
    tax_amount: Money;
    tax_name_snapshot: string;
    tax_rate_snapshot: number;
    tax_description_snapshot?: string;
  }> = [];

  taxAggregation.forEach((taxData, taxRateId) => {
    const proportionalTaxAmount = multiplyMoney(taxData.total_amount, paymentProportion);
    
    if (isPositive(proportionalTaxAmount)) {
      paymentTaxBreakdown.push({
        tax_rate_id: taxRateId,
        tax_amount: proportionalTaxAmount,
        tax_name_snapshot: taxData.tax_name_snapshot,
        tax_rate_snapshot: taxData.tax_rate_snapshot,
        tax_description_snapshot: taxData.tax_description_snapshot
      });
    }
  });

  return paymentTaxBreakdown;
}