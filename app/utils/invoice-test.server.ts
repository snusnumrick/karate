// Simple test file to verify invoice services work correctly
// This can be run manually to test the implementation

import { createInvoiceEntity, getInvoiceEntities } from "~/services/invoice-entity.server";
import { createInvoice, getInvoices, generateInvoiceNumber } from "~/services/invoice.server";
import type { CreateInvoiceEntityData, CreateInvoiceData } from "~/types/invoice";
import { fromDollars } from "~/utils/money";

/**
 * Test invoice entity creation and retrieval
 */
export async function testInvoiceEntities() {
  console.log("Testing invoice entity operations...");
  
  try {
    // Test creating an entity
    const entityData: CreateInvoiceEntityData = {
      name: "Test Family",
      entity_type: "family",
      contact_person: "John Doe",
      email: "john@example.com",
      phone: "(555) 123-4567",
      address_line1: "123 Test St",
      city: "Test City",
      state: "CA",
      postal_code: "12345",
      payment_terms: "Net 30",
    };

    const entity = await createInvoiceEntity(entityData);
    console.log("✅ Entity created:", entity.id);

    // Test retrieving entities
    const { entities } = await getInvoiceEntities();
    console.log("✅ Retrieved entities:", entities.length);

    return entity;
  } catch (error) {
    console.error("❌ Entity test failed:", error);
    throw error;
  }
}

/**
 * Test invoice creation and retrieval
 */
export async function testInvoices() {
  console.log("Testing invoice operations...");
  
  try {
    // First create an entity
    const entity = await testInvoiceEntities();

    // Test invoice number generation
    const invoiceNumber = await generateInvoiceNumber();
    console.log("✅ Generated invoice number:", invoiceNumber);

    // Test creating an invoice
    const invoiceData: CreateInvoiceData = {
      entity_id: entity.id,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: "Test invoice",
      line_items: [
        {
          item_type: "class_enrollment",
          description: "Monthly Karate Classes",
          quantity: 1,
          unit_price: fromDollars(100.00),
          tax_rate: 0.08,
        },
        {
          item_type: "fee",
          description: "Registration Fee",
          quantity: 1,
          unit_price: fromDollars(25.00),
          tax_rate: 0.08,
        },
      ],
    };

    const invoice = await createInvoice(invoiceData);
    console.log("✅ Invoice created:", invoice.id);
    console.log("✅ Invoice total:", invoice.total_amount);

    // Test retrieving invoices
    const { invoices } = await getInvoices();
    console.log("✅ Retrieved invoices:", invoices.length);

    return invoice;
  } catch (error) {
    console.error("❌ Invoice test failed:", error);
    throw error;
  }
}

/**
 * Run all tests
 */
export async function runInvoiceTests() {
  console.log("🧪 Starting invoice system tests...");
  
  try {
    await testInvoiceEntities();
    await testInvoices();
    console.log("🎉 All tests passed!");
  } catch (error) {
    console.error("💥 Tests failed:", error);
    throw error;
  }
}

// Export for manual testing
if (typeof window === "undefined") {
  // Only run in server environment
  console.log("Invoice test utilities loaded. Call runInvoiceTests() to test.");
}