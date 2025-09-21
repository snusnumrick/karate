import {useMemo} from "react";
import type {CreateInvoiceLineItemData, TaxRate, InvoiceCalculations} from "~/types/invoice";
import { 
  calculateLineItemSubtotal, 
  calculateLineItemDiscount,
  calculateLineItemTaxWithRates
} from "~/utils/line-item-helpers";
import { addMoney, ZERO_MONEY } from "~/utils/money";

export function useInvoiceCalculations(
  lineItems: CreateInvoiceLineItemData[],
  taxRatesByItemType: {
    class_enrollment: TaxRate[];
    individual_session: TaxRate[];
    product: TaxRate[];
    fee: TaxRate[];
    other: TaxRate[];
  } = { class_enrollment: [], individual_session: [], product: [], fee: [], other: [] }
): InvoiceCalculations {
  return useMemo(() => {
    // Flatten all tax rates into a single array for calculations
    const allTaxRates = [
      ...taxRatesByItemType.class_enrollment,
      ...taxRatesByItemType.individual_session,
      ...taxRatesByItemType.product,
      ...taxRatesByItemType.fee,
      ...taxRatesByItemType.other
    ];
    if (!lineItems || lineItems.length === 0) {
      return {
        subtotal: ZERO_MONEY,
        tax_amount: ZERO_MONEY,
        discount_amount: ZERO_MONEY,
        total_amount: ZERO_MONEY,
      };
    }

    let subtotalMoney = ZERO_MONEY;
    let totalTaxMoney = ZERO_MONEY;
    let totalDiscountMoney = ZERO_MONEY;

    lineItems.forEach((item) => {
      const itemSubtotal = calculateLineItemSubtotal(item);
      subtotalMoney = addMoney(subtotalMoney, itemSubtotal);
      totalDiscountMoney = addMoney(totalDiscountMoney, calculateLineItemDiscount(item));
      
      // Use new tax calculation with multiple rates
      const itemTax = calculateLineItemTaxWithRates(
        item.quantity,
        item.unit_price,
        item.tax_rate_ids || [],
        allTaxRates,
        item.discount_rate || 0
      );
      totalTaxMoney = addMoney(totalTaxMoney, itemTax);
    });

    const totalMoney = addMoney(addMoney(subtotalMoney, totalTaxMoney), totalDiscountMoney.multiply(-1));

    return {
      subtotal: subtotalMoney,
      tax_amount: totalTaxMoney,
      discount_amount: totalDiscountMoney,
      total_amount: totalMoney,
    };
  }, [lineItems, taxRatesByItemType]);
}
