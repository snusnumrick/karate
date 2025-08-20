import {useMemo} from "react";
import type {CreateInvoiceLineItemData, TaxRate, InvoiceCalculations} from "~/types/invoice";
import { 
  calculateLineItemSubtotal, 
  calculateLineItemDiscount,
  calculateLineItemTaxWithRates
} from "~/utils/line-item-helpers";

export function useInvoiceCalculations(
  lineItems: CreateInvoiceLineItemData[],
  taxRates: TaxRate[] = []
): InvoiceCalculations {
  return useMemo(() => {
    if (!lineItems || lineItems.length === 0) {
      return {
        subtotal: 0,
        tax_amount: 0,
        discount_amount: 0,
        total_amount: 0,
      };
    }

    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    lineItems.forEach((item) => {
      const itemSubtotal = calculateLineItemSubtotal(item);
      subtotal += itemSubtotal;
      totalDiscount += calculateLineItemDiscount(item);
      
      // Use new tax calculation with multiple rates
      totalTax += calculateLineItemTaxWithRates(
        item.quantity,
        item.unit_price,
        item.tax_rate_ids || [],
        taxRates,
        item.discount_rate || 0
      );
    });

    const total = subtotal + totalTax - totalDiscount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax_amount: Math.round(totalTax * 100) / 100,
      discount_amount: Math.round(totalDiscount * 100) / 100,
      total_amount: Math.round(total * 100) / 100,
    };
  }, [lineItems, taxRates]);
}
