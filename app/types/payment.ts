// Payment-related type definitions

// Import Database type for EligibilityStatus
import type { Database } from './database.types';
import {IndividualSessionInfo} from "~/services/payment-eligibility.server";
import {Money} from "~/utils/money";

// Eligibility status for students
export type EligibilityStatus = {
  eligible: boolean;
  reason: 'Trial' | 'Paid - Monthly' | 'Paid - Yearly' | 'Expired';
  lastPaymentDate?: string; // Optional: ISO date string of the last successful payment
  type?: Database['public']['Enums']['payment_type_enum']; // Use 'type' to match DB column
  paidUntil?: string;
};

// Student payment detail interface used in payment forms
export interface StudentPaymentDetail {
  studentId: string;
  firstName: string;
  lastName: string;
  eligibility?: EligibilityStatus; // Current status (Trial, Paid, Expired)
  needsPayment: boolean; // True if status is Trial or Expired
  nextPaymentAmount: Money; // Amount in dollars for monthly payment
  nextPaymentTierLabel: string; // Label for payment (Monthly)
  pastPaymentCount: number; // Kept for historical tracking
  individualSessions?: IndividualSessionInfo;
  // nextPaymentPriceId: string; // Stripe Price ID for monthly payment
}

// Payment options type
export type PaymentOption = 'monthly' | 'yearly' | 'individual';