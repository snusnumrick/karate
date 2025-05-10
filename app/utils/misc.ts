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
 * - If `options.formatString` is provided, it uses `date-fns/format`.
 * - Otherwise, it uses `Intl.DateTimeFormat`. The style (date-only or date-time)
 *   is determined by `options.type` (defaults to 'date').
 *
 * @param date The date string or Date object.
 * @param options Optional configuration for formatting.
 * @param options.locale Optional. Locale for formatting (e.g., 'en-US'). Defaults to `siteConfig.locale`.
 *                       Influences both `Intl.DateTimeFormat` and `date-fns/format` (if mapped).
 * @param options.formatString Optional. A `date-fns` format string (e.g., 'yyyy-MM-dd', 'P', 'Pp').
 *                             If provided, this takes precedence over `options.type` for styling.
 * @param options.type Optional. Determines default formatting style if `formatString` is not used.
 *                     'date' (default): Formats as date only (e.g., 'Jan 1, 2024').
 *                     'datetime': Formats as date and time (e.g., 'Jan 1, 2024, 1:30 PM').
 * @returns The formatted date string, or 'N/A' or 'Invalid Date'.
 */
export function formatDate(
    date: string | Date | null | undefined,
    options?: {
        locale?: string;
        formatString?: string;
        type?: 'date' | 'datetime';
    }
): string {
    if (!date) {
        return 'N/A';
    }

    const currentLocale = options?.locale || siteConfig.locale;
    const formatType = options?.type || 'date'; // Default to 'date'

    try {
        const dateObj = typeof date === 'string' ? parseISO(date) : date;
        if (isNaN(dateObj.getTime())) {
            throw new Error('Invalid date value');
        }

        if (options?.formatString) {
            // Map currentLocale to a date-fns locale object for date-fns/format.
            // This is a simplified mapping; a more robust one might be needed for more locales.
            const dfnsLocale = currentLocale === 'en-CA' ? enCA : undefined;
            return fnsFormat(dateObj, options.formatString, { locale: dfnsLocale });
        } else {
            let intlOptions: Intl.DateTimeFormatOptions;
            if (formatType === 'datetime') {
                intlOptions = {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: 'numeric', minute: '2-digit', hour12: true,
                };
            } else { // 'date'
                intlOptions = {
                    year: 'numeric', month: 'short', day: 'numeric',
                };
            }
            return new Intl.DateTimeFormat(currentLocale, intlOptions).format(dateObj);
        }
    } catch (error) {
        // Log specific error type for better debugging if needed
        console.error(`Error formatting date (type: ${formatType}, locale: ${currentLocale}):`, error);
        return 'Invalid Date';
    }
}
