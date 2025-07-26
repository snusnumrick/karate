import {useMemo} from "react";
import type {CreateInvoiceLineItemData} from "~/types/invoice";
import { calculateLineItemTotal, calculateLineItemSubtotal, calculateLineItemTax, calculateLineItemDiscount } from "~/utils/line-item-helpers";

export interface InvoiceCalculations {
  subtotal: number;
  totalTax: number;
  totalDiscount: number;
  total: number;
  lineItemTotals: number[];
}

export function useInvoiceCalculations(lineItems: CreateInvoiceLineItemData[]): InvoiceCalculations {
  return useMemo(() => {
    const lineItemTotals = lineItems.map(item => calculateLineItemTotal(item));
    
    const subtotal = lineItems.reduce((sum, item) => sum + calculateLineItemSubtotal(item), 0);
    const totalTax = lineItems.reduce((sum, item) => sum + calculateLineItemTax(item), 0);
    const totalDiscount = lineItems.reduce((sum, item) => sum + calculateLineItemDiscount(item), 0);
    const total = subtotal + totalTax - totalDiscount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      total: Math.round(total * 100) / 100,
      lineItemTotals: lineItemTotals.map(total => Math.round(total * 100) / 100),
    };
  }, [lineItems]);
}
