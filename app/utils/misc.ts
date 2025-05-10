import { parseISO, format as fnsFormat } from 'date-fns'; // Import parseISO and format
import { enCA } from 'date-fns/locale'; // Import specific date-fns locale
import { siteConfig } from '~/config/site'; // Import siteConfig

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
    locale: string = siteConfig.locale // Use locale from siteConfig
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
 * Formats a date string or Date object.
 * If a formatString is provided, it uses date-fns/format. Otherwise, it uses Intl.DateTimeFormat.
 * Example (default): 'Jan 1, 2024'
 * Example (with formatString 'P'): '01/01/2024'
 * @param date The date string or Date object.
 * @param localeOverride Optional. The locale for Intl.DateTimeFormat (e.g., 'en-US'). Defaults to siteConfig.locale. Also influences date-fns locale selection if mapped.
 * @param formatString Optional. A date-fns format string (e.g., 'yyyy-MM-dd', 'P').
 * @returns The formatted date string, or 'N/A' or 'Invalid Date'.
 */
export function formatDate(
    date: string | Date | null | undefined,
    localeOverride?: string,
    formatString?: string
): string {
    if (!date) {
        return 'N/A';
    }
    const currentLocale = localeOverride || siteConfig.locale;
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        if (isNaN(dateObj.getTime())) {
            throw new Error('Invalid date value');
        }

        if (formatString) {
            // Map currentLocale to a date-fns locale object.
            // This is a simplified mapping; a more robust one might be needed for more locales.
            const dfnsLocale = currentLocale === 'en-CA' ? enCA : undefined;
            return fnsFormat(dateObj, formatString, { locale: dfnsLocale });
        } else {
            return new Intl.DateTimeFormat(currentLocale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            }).format(dateObj);
        }
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid Date';
    }
}

/**
 * Formats a date string or Date object into a date and time format.
 * If a formatString is provided, it uses date-fns/format. Otherwise, it uses Intl.DateTimeFormat.
 * Example (default): 'Jan 1, 2024, 1:30 PM'
 * Example (with formatString 'Pp'): '01/01/2024, 1:30 PM'
 * @param date The date string or Date object.
 * @param localeOverride Optional. The locale for Intl.DateTimeFormat (e.g., 'en-US'). Defaults to siteConfig.locale. Also influences date-fns locale selection if mapped.
 * @param formatString Optional. A date-fns format string (e.g., 'yyyy-MM-dd HH:mm', 'Pp').
 * @returns The formatted date-time string, or 'N/A' or 'Invalid Date'.
 */
export function formatDateTime(
    date: string | Date | null | undefined,
    localeOverride?: string,
    formatString?: string
): string {
     if (!date) {
        return 'N/A';
    }
    const currentLocale = localeOverride || siteConfig.locale;
    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
         if (isNaN(dateObj.getTime())) {
            throw new Error('Invalid date value');
        }

        if (formatString) {
            const dfnsLocale = currentLocale === 'en-CA' ? enCA : undefined;
            return fnsFormat(dateObj, formatString, { locale: dfnsLocale });
        } else {
            return new Intl.DateTimeFormat(currentLocale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true, // Use AM/PM
            }).format(dateObj);
        }
    } catch (error) {
        console.error('Error formatting date-time:', error);
        return 'Invalid Date';
    }
}
