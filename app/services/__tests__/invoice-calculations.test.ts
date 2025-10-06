import { describe, it, expect } from 'vitest';
import { calculateInvoiceTotals, calculateLineItemTotalsWithRates } from '../invoice.server';
import { fromDollars, toCents, ZERO_MONEY, addMoney } from '~/utils/money';
import type { InvoiceLineItem, TaxRate } from '~/types/invoice';

describe('Invoice Calculations', () => {
  describe('calculateLineItemTotalsWithRates', () => {
    it('calculates totals with no tax', () => {
      const result = calculateLineItemTotalsWithRates(
        2, // quantity
        fromDollars(50), // unit price
        [], // no tax rates
        [],
        0 // no discount
      );

      expect(toCents(result.line_total)).toBe(10000); // 2 * $50 = $100
      expect(toCents(result.tax_amount)).toBe(0);
      expect(toCents(result.discount_amount)).toBe(0);
      expect(toCents(result.final_amount)).toBe(10000);
    });

    it('calculates totals with single tax rate', () => {
      const taxRates: TaxRate[] = [
        {
          id: 'gst-id',
          name: 'GST',
          rate: 0.05,
          description: 'Goods and Services Tax',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result = calculateLineItemTotalsWithRates(
        1, // quantity
        fromDollars(100), // unit price
        ['gst-id'],
        taxRates,
        0
      );

      expect(toCents(result.line_total)).toBe(10000); // $100
      expect(toCents(result.tax_amount)).toBe(500); // $5 (5% of $100)
      expect(toCents(result.discount_amount)).toBe(0);
      expect(toCents(result.final_amount)).toBe(10500); // $105
    });

    it('calculates totals with multiple tax rates (GST + PST)', () => {
      const taxRates: TaxRate[] = [
        {
          id: 'gst-id',
          name: 'GST',
          rate: 0.05,
          description: 'Goods and Services Tax',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'pst-id',
          name: 'PST_BC',
          rate: 0.07,
          description: 'Provincial Sales Tax (British Columbia)',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result = calculateLineItemTotalsWithRates(
        1, // quantity
        fromDollars(100), // unit price
        ['gst-id', 'pst-id'],
        taxRates,
        0
      );

      expect(toCents(result.line_total)).toBe(10000); // $100
      expect(toCents(result.tax_amount)).toBe(1200); // $12 (5% + 7% of $100)
      expect(toCents(result.discount_amount)).toBe(0);
      expect(toCents(result.final_amount)).toBe(11200); // $112
    });

    it('calculates totals with multiple tax rates and discount', () => {
      const taxRates: TaxRate[] = [
        {
          id: 'gst-id',
          name: 'GST',
          rate: 0.05,
          description: 'Goods and Services Tax',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'pst-id',
          name: 'PST_BC',
          rate: 0.07,
          description: 'Provincial Sales Tax (British Columbia)',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result = calculateLineItemTotalsWithRates(
        1, // quantity
        fromDollars(100), // unit price
        ['gst-id', 'pst-id'],
        taxRates,
        10 // 10% discount
      );

      expect(toCents(result.line_total)).toBe(10000); // $100
      expect(toCents(result.discount_amount)).toBe(1000); // $10 (10% of $100)
      // Tax is calculated on discounted amount: $90
      expect(toCents(result.tax_amount)).toBe(1080); // $10.80 (12% of $90)
      expect(toCents(result.final_amount)).toBe(10080); // $100.80 ($90 + $10.80 tax)
    });

    it('handles multiple quantities correctly', () => {
      const taxRates: TaxRate[] = [
        {
          id: 'gst-id',
          name: 'GST',
          rate: 0.05,
          description: 'Goods and Services Tax',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const result = calculateLineItemTotalsWithRates(
        3, // quantity
        fromDollars(25), // unit price
        ['gst-id'],
        taxRates,
        0
      );

      expect(toCents(result.line_total)).toBe(7500); // 3 * $25 = $75
      expect(toCents(result.tax_amount)).toBe(375); // $3.75 (5% of $75)
      expect(toCents(result.final_amount)).toBe(7875); // $78.75
    });
  });

  describe('calculateInvoiceTotals', () => {
    it('sums line items with no taxes', () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: '1',
          invoice_id: 'inv-1',
          item_type: 'other',
          description: 'Item 1',
          quantity: 1,
          unit_price: fromDollars(50),
          line_total: fromDollars(50),
          tax_amount: ZERO_MONEY,
          discount_rate: 0,
          discount_amount: ZERO_MONEY,
          sort_order: 0,
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          invoice_id: 'inv-1',
          item_type: 'other',
          description: 'Item 2',
          quantity: 2,
          unit_price: fromDollars(25),
          line_total: fromDollars(50),
          tax_amount: ZERO_MONEY,
          discount_rate: 0,
          discount_amount: ZERO_MONEY,
          sort_order: 1,
          created_at: new Date().toISOString(),
        },
      ];

      const totals = calculateInvoiceTotals(lineItems);

      expect(toCents(totals.subtotal)).toBe(10000); // $100
      expect(toCents(totals.tax_amount)).toBe(0);
      expect(toCents(totals.discount_amount)).toBe(0);
      expect(toCents(totals.total_amount)).toBe(10000); // $100
    });

    it('sums line items with multiple taxes', () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: '1',
          invoice_id: 'inv-1',
          item_type: 'other',
          description: 'Item 1',
          quantity: 1,
          unit_price: fromDollars(100),
          line_total: fromDollars(100),
          tax_amount: fromDollars(12), // GST 5% + PST 7%
          discount_rate: 0,
          discount_amount: ZERO_MONEY,
          sort_order: 0,
          created_at: new Date().toISOString(),
        },
      ];

      const totals = calculateInvoiceTotals(lineItems);

      expect(toCents(totals.subtotal)).toBe(10000); // $100
      expect(toCents(totals.tax_amount)).toBe(1200); // $12
      expect(toCents(totals.discount_amount)).toBe(0);
      expect(toCents(totals.total_amount)).toBe(11200); // $112
    });

    it('handles multiple line items with different tax amounts', () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: '1',
          invoice_id: 'inv-1',
          item_type: 'other',
          description: 'Item with GST+PST',
          quantity: 1,
          unit_price: fromDollars(100),
          line_total: fromDollars(100),
          tax_amount: fromDollars(12), // 12%
          discount_rate: 0,
          discount_amount: ZERO_MONEY,
          sort_order: 0,
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          invoice_id: 'inv-1',
          item_type: 'other',
          description: 'Item with GST only',
          quantity: 1,
          unit_price: fromDollars(50),
          line_total: fromDollars(50),
          tax_amount: fromDollars(2.5), // 5%
          discount_rate: 0,
          discount_amount: ZERO_MONEY,
          sort_order: 1,
          created_at: new Date().toISOString(),
        },
      ];

      const totals = calculateInvoiceTotals(lineItems);

      expect(toCents(totals.subtotal)).toBe(15000); // $150
      expect(toCents(totals.tax_amount)).toBe(1450); // $14.50
      expect(toCents(totals.discount_amount)).toBe(0);
      expect(toCents(totals.total_amount)).toBe(16450); // $164.50
    });

    it('handles discounts correctly', () => {
      const lineItems: InvoiceLineItem[] = [
        {
          id: '1',
          invoice_id: 'inv-1',
          item_type: 'other',
          description: 'Item with discount',
          quantity: 1,
          unit_price: fromDollars(100),
          line_total: fromDollars(100),
          tax_amount: fromDollars(10.80), // 12% of $90 (after $10 discount)
          discount_rate: 10,
          discount_amount: fromDollars(10),
          sort_order: 0,
          created_at: new Date().toISOString(),
        },
      ];

      const totals = calculateInvoiceTotals(lineItems);

      expect(toCents(totals.subtotal)).toBe(10000); // $100
      expect(toCents(totals.tax_amount)).toBe(1080); // $10.80
      expect(toCents(totals.discount_amount)).toBe(1000); // $10
      // Total = subtotal + tax - discount = 100 + 10.80 - 10 = 100.80
      expect(toCents(totals.total_amount)).toBe(10080); // $100.80
    });
  });

  describe('Regression tests for multi-tax bugs', () => {
    it('correctly calculates total with GST and PST (the -$7 bug)', () => {
      // This tests the exact scenario that caused the -$7 outstanding amount bug
      const taxRates: TaxRate[] = [
        {
          id: 'gst-id',
          name: 'GST',
          rate: 0.05,
          description: 'Goods and Services Tax',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'pst-id',
          name: 'PST_BC',
          rate: 0.07,
          description: 'Provincial Sales Tax (British Columbia)',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const lineItemCalcs = calculateLineItemTotalsWithRates(
        1,
        fromDollars(100),
        ['gst-id', 'pst-id'],
        taxRates,
        0
      );

      // Create a line item with calculated values
      const lineItem: InvoiceLineItem = {
        id: '1',
        invoice_id: 'inv-1',
        item_type: 'other',
        description: 'Test item',
        quantity: 1,
        unit_price: fromDollars(100),
        line_total: lineItemCalcs.line_total,
        tax_amount: lineItemCalcs.tax_amount,
        discount_rate: 0,
        discount_amount: lineItemCalcs.discount_amount,
        sort_order: 0,
        created_at: new Date().toISOString(),
      };

      const invoiceTotals = calculateInvoiceTotals([lineItem]);

      // Assert the correct values
      expect(toCents(invoiceTotals.subtotal)).toBe(10000); // $100
      expect(toCents(invoiceTotals.tax_amount)).toBe(1200); // $12 (not $5!)
      expect(toCents(invoiceTotals.total_amount)).toBe(11200); // $112 (not $105!)

      // The outstanding amount should be 0 if paid in full
      const amountPaid = invoiceTotals.total_amount;
      const outstanding = toCents(invoiceTotals.total_amount) - toCents(amountPaid);
      expect(outstanding).toBe(0); // Should be 0, not -$7
    });

    it('ensures tax calculation is consistent across different scenarios', () => {
      const taxRates: TaxRate[] = [
        {
          id: 'gst-id',
          name: 'GST',
          rate: 0.05,
          description: 'Goods and Services Tax',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: 'pst-id',
          name: 'PST_BC',
          rate: 0.07,
          description: 'Provincial Sales Tax (British Columbia)',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      // Test with different amounts
      const testCases = [
        { amount: 100, expectedTax: 12 },
        { amount: 50, expectedTax: 6 },
        { amount: 200, expectedTax: 24 },
        { amount: 1, expectedTax: 0.12 },
      ];

      testCases.forEach(({ amount, expectedTax }) => {
        const result = calculateLineItemTotalsWithRates(
          1,
          fromDollars(amount),
          ['gst-id', 'pst-id'],
          taxRates,
          0
        );

        expect(toCents(result.tax_amount)).toBe(Math.round(expectedTax * 100));
        expect(toCents(result.final_amount)).toBe(
          Math.round((amount + expectedTax) * 100)
        );
      });
    });
  });
});
