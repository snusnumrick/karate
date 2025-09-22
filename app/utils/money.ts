import Dinero from 'dinero.js';
import { siteConfig } from '~/config/site';

/**
 * Money utility functions using dinero.js for type-safe monetary operations
 * All monetary values are stored internally as cents (smallest currency unit)
 */

// Type definitions
export type Money = Dinero.Dinero;
export type MoneyInput = number | string | Money | null;
export type MoneyJSON = { amount: number; currency: string; precision?: number };
export type MoneyLike = Money | MoneyJSON | number | string;

/**
 * Create a Money object from various input types
 * @param amount - Amount in dollars (number), cents (if fromCents=true), or existing Money object
 * @param fromCents - If true, treats number input as cents instead of dollars
 */
export function createMoney(amount: MoneyInput, fromCents = false): Money {
  // Handle null/undefined case
  if (amount === null || amount === undefined) {
    return Dinero({ amount: 0, currency: siteConfig.localization.currency as Dinero.Currency, precision: 2 });
  }
  
  if (typeof amount === 'object' && 'getAmount' in amount) {
    // Already a dinero object
    return amount;
  }
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) {
    throw new Error(`Invalid monetary amount: ${amount} (type: ${typeof amount}, parsed: ${numAmount})`);
  }
  
  // Convert to cents if input is in dollars
  const cents = fromCents ? Math.round(numAmount) : Math.round(numAmount * 100);
  
  return Dinero({ amount: cents, currency: siteConfig.localization.currency as Dinero.Currency });
}

/**
 * Create Money from cents (database values)
 */
export function fromCents(cents: number): Money {
  return createMoney(cents, true);
}

/**
 * Create Money from dollars
 */
export function fromDollars(dollars: number): Money {
  return createMoney(dollars, false);
}

/**
 * Convert Money to cents (for database storage)
 */
export function toCents(money: Money): number {
  return money.getAmount();
}

/**
 * Get amount in cents from Money object (alias for toCents)
 */
export function getAmount(money: Money): number {
  return money.getAmount();
}

/**
 * Convert Money to dollars (for display/calculations)
 */
export function toDollars(money: Money): number {
  return money.getAmount() / 100;
}

/**
 * Serialize Money to JSON for transport
 */
export function serializeMoney(money: Money): MoneyJSON {
  // Dinero's toJSON yields { amount, currency }
  return money.toJSON() as unknown as MoneyJSON;
}

/**
 * Deserialize Money from JSON
 */
export function deserializeMoney(json: MoneyJSON): Money {
  // precision is not used with Dinero v1 default; amount is cents
  return Dinero({ amount: Math.round(json.amount), currency: json.currency as Dinero.Currency });
}

/**
 * Type guard for MoneyJSON. Useful on client when receiving data over the wire.
 */
export function isMoneyJSON(value: unknown): value is MoneyJSON {
  return !!value && typeof value === 'object' && 'amount' in (value as Record<string, unknown>) && 'currency' in (value as Record<string, unknown>);
}

/**
 * Coerce a value into Money. Accepts dollars (number), Money JSON, Money objects, or strings.
 * 
 * String parsing strategies:
 * - JSON strings: Attempts to parse as MoneyJSON first
 * - Numeric strings: Parsed as dollar amounts (e.g., "15.99" -> $15.99)
 * - Empty/null strings: Returns zero money
 */
export function toMoney(value: MoneyLike | unknown): Money {
  if (typeof value === 'number') return fromDollars(value);
  if (typeof value === 'string') {
    // Handle empty/null strings
    if (!value || value.trim() === '') return fromCents(0);
    
    // Try to parse as JSON first (Money object)
    if (value.startsWith('{')) {
      try {
        const parsed = JSON.parse(value);
        if (isMoneyJSON(parsed)) return deserializeMoney(parsed);
      } catch {
        // Fall through to numeric parsing
      }
    }
    
    // Parse as numeric dollar amount
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) return fromDollars(numValue);
    
    throw new Error(`Invalid string value for toMoney: "${value}"`);
  }
  if (isMoneyJSON(value)) return deserializeMoney(value);
  if (value && typeof value === 'object' && 'getAmount' in (value as Record<string, unknown>)) {
    return value as Money;
  }
  throw new Error('Invalid value for toMoney');
}

/**
 * Format Money for display
 * @param money - Money object to format
 * @param options - Formatting options
 */
export function formatMoney(
  money: Money,
  options: {
    showCurrency?: boolean;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  } = {}
): string {
  const {
    showCurrency = false,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options;
  
  const dollars = toDollars(money);
  
  const formatted = new Intl.NumberFormat('en-US', {
    style: showCurrency ? 'currency' : 'decimal',
    currency: showCurrency ? (siteConfig.localization.currency as Dinero.Currency) : undefined,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(dollars);
  
  return formatted;
}

/**
 * Add two Money objects
 */
export function addMoney(a: Money, b: Money): Money {
  return a.add(b);
}

/**
 * Subtract two Money objects
 */
export function subtractMoney(a: Money, b: Money): Money {
  return a.subtract(b);
}

/**
 * Multiply Money by a factor
 */
export function multiplyMoney(money: Money, factor: number): Money {
  return money.multiply(factor);
}

/**
 * Divide Money by a divisor
 */
export function divideMoney(money: Money, divisor: number): Money {
  return money.divide(divisor);
}

/**
 * Calculate percentage of Money
 */
export function percentageOf(money: Money, percentage: number): Money {
  return money.multiply(percentage / 100);
}

/**
 * Check if Money is zero
 */
export function isZero(money: Money): boolean {
  return money.getAmount() === 0;
}

/**
 * Check if Money is positive
 */
export function isPositive(money: Money): boolean {
  return money.getAmount() > 0;
}

/**
 * Check if Money is negative
 */
export function isNegative(money: Money): boolean {
  return money.getAmount() < 0;
}

/**
 * Compare two Money objects
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareMoney(a: Money, b: Money): number {
  const aAmount = a.getAmount();
  const bAmount = b.getAmount();
  
  if (aAmount < bAmount) return -1;
  if (aAmount > bAmount) return 1;
  return 0;
}

/**
 * Get the maximum of two Money objects
 */
export function maxMoney(a: Money, b: Money): Money {
  return compareMoney(a, b) >= 0 ? a : b;
}

/**
 * Get the minimum of two Money objects
 */
export function minMoney(a: Money, b: Money): Money {
  return compareMoney(a, b) <= 0 ? a : b;
}

/**
 * Sum an array of Money objects
 */
export function sumMoney(amounts: Money[]): Money {
  return amounts.reduce((sum, amount) => addMoney(sum, amount), fromCents(0));
}

/**
 * Convert legacy dollar amounts to Money objects
 * Used for migrating existing code that stores dollars as numbers
 */
export function migrateDollarAmount(dollarAmount: number | null | undefined): Money {
  if (dollarAmount == null) {
    return fromCents(0);
  }
  return fromDollars(dollarAmount);
}

/**
 * Convert legacy cent amounts to Money objects
 * Used for migrating existing code that stores cents as numbers
 */
export function migrateCentAmount(centAmount: number | null | undefined): Money {
  if (centAmount == null) {
    return fromCents(0);
  }
  return fromCents(centAmount);
}

/**
 * Calculate tax amount
 */
export function calculateTax(subtotal: Money, taxRate: number): Money {
  return multiplyMoney(subtotal, taxRate);
}

/**
 * Calculate discount amount
 */
export function calculateDiscount(subtotal: Money, discountRate: number): Money {
  return multiplyMoney(subtotal, discountRate);
}

/**
 * Apply discount to an amount
 */
export function applyDiscount(amount: Money, discount: Money): Money {
  return subtractMoney(amount, discount);
}

/**
 * Calculate total with tax
 */
export function calculateTotal(subtotal: Money, tax: Money): Money {
  return addMoney(subtotal, tax);
}

// Constants for common amounts
/**
 * Convert an array of cent amounts to Money objects
 */
export function fromCentsArray(centAmounts: (number | null | undefined)[]): Money[] {
  return centAmounts.map(cents => fromCents(cents || 0));
}

/**
 * Format Money as dollars string without currency symbol
 */
export function formatDollars(money: Money, decimals = 2): string {
    return formatMoney(money, {showCurrency: false, minimumFractionDigits: decimals, maximumFractionDigits: decimals});
}

/**
 * Parse a dollar string to Money
 */
export function parseDollars(dollarString: string): Money {
  const amount = parseFloat(dollarString);
  if (isNaN(amount)) {
    throw new Error(`Invalid dollar amount: ${dollarString}`);
  }
  return fromDollars(amount);
}

/**
 * Calculate percentage as Money (for discount/tax calculations)
 */
export function calculatePercentage(base: Money, percentage: number): Money {
  return base.multiply(percentage).divide(100);
}

export function negativeMoney(base: Money): Money {
    return subtractMoney(ZERO_MONEY, base);
}

/**
 * Convert percentage rate to display format (0.15 -> "15.00%")
 */
export function formatPercentage(rate: number, decimals = 2): string {
  return `${(rate * 100).toFixed(decimals)}%`;
}

export function ratioMoney(a: Money, b: Money) : number {
    return a.getAmount() / b.getAmount();
}

/**
 * Safe division that returns zero for division by zero
 */
export function safeDivide(money: Money, divisor: number): Money {
  if (divisor === 0) return ZERO_MONEY;
  return money.divide(divisor);
}

/**
 * Calculate completion percentage as number (for progress bars, etc.)
 */
export function calculateCompletionPercentage(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

export const ZERO_MONEY = fromCents(0);
export const ONE_DOLLAR = fromDollars(1);
export const ONE_CENT = fromCents(1);
