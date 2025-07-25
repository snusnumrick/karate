import { useMemo } from "react";
import { siteConfig } from "~/config/site";
import type { CreateInvoiceLineItemData } from "~/types/invoice";

export interface InvoiceCalculations {
  subtotal: number;
  totalTax: number;
  totalDiscount: number;
  total: number;
  lineItemTotals: number[];
}

export interface UseInvoiceCalculationsProps {
  lineItems: CreateInvoiceLineItemData[];
}

export function useInvoiceCalculations({ lineItems }: UseInvoiceCalculationsProps): InvoiceCalculations {
  const calculations = useMemo(() => {
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    const lineItemTotals: number[] = [];

    lineItems.forEach((item) => {
      // Calculate line item total before tax and discount
      const lineSubtotal = item.quantity * item.unit_price;
      
      // Calculate discount amount
      const discountRate = item.discount_rate || 0;
      const discountAmount = lineSubtotal * (discountRate / 100);
      
      // Calculate taxable amount (after discount)
      const taxableAmount = lineSubtotal - discountAmount;
      
      // Calculate tax amount
      const taxRate = item.tax_rate || 0;
      const taxAmount = taxableAmount * (taxRate / 100);
      
      // Calculate final line item total
      const lineTotal = taxableAmount + taxAmount;
      
      lineItemTotals.push(lineTotal);
      subtotal += lineSubtotal;
      totalDiscount += discountAmount;
      totalTax += taxAmount;
    });

    const total = subtotal - totalDiscount + totalTax;

    return {
      subtotal,
      totalTax,
      totalDiscount,
      total,
      lineItemTotals,
    };
  }, [lineItems]);

  return calculations;
}

export function calculateLineItemTotal(item: CreateInvoiceLineItemData): number {
  const lineSubtotal = item.quantity * item.unit_price;
  const discountRate = item.discount_rate || 0;
  const discountAmount = lineSubtotal * (discountRate / 100);
  const taxableAmount = lineSubtotal - discountAmount;
  const taxRate = item.tax_rate || 0;
  const taxAmount = taxableAmount * (taxRate / 100);
  
  return taxableAmount + taxAmount;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(siteConfig.localization.locale, {
    style: 'currency',
    currency: siteConfig.localization.currency,
  }).format(amount);
}

export function formatPercentage(rate: number): string {
  return `${rate.toFixed(1)}%`;
}