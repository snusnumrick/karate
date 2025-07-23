import type { InvoiceItemType, CreateInvoiceLineItemData } from "~/types/invoice";

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
    unit_price: 0,
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
  
  if (item.unit_price < 0) {
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
  monthlyFee: number,
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
  price: number,
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
  amount: number
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
  discountAmount: number
): CreateInvoiceLineItemData {
  return {
    item_type: 'discount',
    description,
    quantity: 1,
    unit_price: -Math.abs(discountAmount), // Ensure negative for discount
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
export function calculateLineItemSubtotal(item: CreateInvoiceLineItemData): number {
  return item.quantity * item.unit_price;
}

/**
 * Calculate line item discount amount
 */
export function calculateLineItemDiscount(item: CreateInvoiceLineItemData): number {
  const subtotal = calculateLineItemSubtotal(item);
  const discountRate = item.discount_rate || 0;
  return subtotal * (discountRate / 100);
}

/**
 * Calculate line item tax amount
 */
export function calculateLineItemTax(item: CreateInvoiceLineItemData): number {
  const subtotal = calculateLineItemSubtotal(item);
  const discount = calculateLineItemDiscount(item);
  const taxableAmount = subtotal - discount;
  const taxRate = item.tax_rate || 0;
  return taxableAmount * (taxRate / 100);
}

/**
 * Calculate line item total
 */
export function calculateLineItemTotal(item: CreateInvoiceLineItemData): number {
  const subtotal = calculateLineItemSubtotal(item);
  const discount = calculateLineItemDiscount(item);
  const tax = calculateLineItemTax(item);
  return subtotal - discount + tax;
}

/**
 * Format service period for display
 */
export function formatServicePeriod(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) {
    return '';
  }
  
  if (startDate && endDate) {
    const start = new Date(startDate).toLocaleDateString();
    const end = new Date(endDate).toLocaleDateString();
    return `${start} - ${end}`;
  }
  
  if (startDate) {
    return `From ${new Date(startDate).toLocaleDateString()}`;
  }
  
  if (endDate) {
    return `Until ${new Date(endDate).toLocaleDateString()}`;
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