import { parseISO } from 'date-fns'; // Import parseISO

/**
 * Formats a date string or Date object into a user-friendly format.
 * Example: 'Jan 1, 2024'
 * @param date The date string or Date object.

/**
 * Formats a number (representing cents) into a currency string (e.g., $12.34).
 * @param amountInCents The amount in cents.
 * @param currencyCode The ISO currency code (default: 'CAD').
 * @param locale The locale for formatting (default: 'en-CA').
 * @returns The formatted currency string, or an empty string if input is invalid.
 */
export function formatCurrency(
    amountInCents: number | null | undefined,
    currencyCode: string = 'CAD',
    locale: string = 'en-CA'
): string {
    if (amountInCents === null || amountInCents === undefined || isNaN(amountInCents)) {
        // console.warn('formatCurrency received invalid input:', amountInCents);
        return ''; // Or return a default like '$0.00' or 'N/A'
    }

    const amountInDollars = amountInCents / 100;

    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amountInDollars);
    } catch (error) {
        console.error('Error formatting currency:', error);
        // Fallback to simple formatting if Intl fails
        return `${currencyCode} ${(amountInDollars).toFixed(2)}`;
    }
}

/**
 * Formats a date string or Date object into a user-friendly format.
 * Example: 'Jan 1, 2024'
 * @param date The date string or Date object.
 * @param   The locale for formatting (default: 'en-CA').
 * @returns The formatted date string, or 'Invalid Date' if input is invalid.
 */
export function formatDate(
    date: string | Date | null | undefined,
    locale: string = 'en-CA'
): string {
    if (!date) {
        return 'N/A';
    }
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        if (isNaN(dateObj.getTime())) {
            throw new Error('Invalid date value');
        }
        return new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }).format(dateObj);
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid Date';
    }
}

/**
 * Formats a date string or Date object into a user-friendly date and time format.
 * Example: 'Jan 1, 2024, 1:30 PM'
 * @param date The date string or Date object.
 * @param locale The locale for formatting (default: 'en-CA').
 * @returns The formatted date-time string, or 'Invalid Date' if input is invalid.
 */
export function formatDateTime(
    date: string | Date | null | undefined,
    locale: string = 'en-CA'
): string {
     if (!date) {
        return 'N/A';
    }
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
         if (isNaN(dateObj.getTime())) {
            throw new Error('Invalid date value');
        }
        return new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true, // Use AM/PM
        }).format(dateObj);
    } catch (error) {
        console.error('Error formatting date-time:', error);
        return 'Invalid Date';
    }
}
