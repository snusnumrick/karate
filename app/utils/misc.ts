import { parseISO, format as fnsFormat } from 'date-fns'; // Import parseISO and format
import { enCA } from 'date-fns/locale'; // Import specific date-fns locale
import { siteConfig } from '~/config/site'; // Import siteConfig
import { type Money, formatMoney, toDollars, fromCents } from './money'; // Import dinero.js utilities
import { parseLocalDate } from '~/components/calendar/utils'; // Import parseLocalDate for timezone-safe date parsing

/**
 * Formats monetary values into a currency string (e.g., $12.34).
 * Supports both legacy number inputs and new dinero.js Money objects.
 * @param amount The amount - can be a Money object, number in cents, or null/undefined
 * @param currencyCode The ISO currency code (default: 'CAD')
 * @param locale The locale for formatting (default: 'en-CA')
 * @returns The formatted currency string, or an empty string if input is invalid
 */
export function formatCurrency(
    amount: Money | number | null | undefined,
    currencyCode?: string,
    locale?: string
): string {
    // Handle null/undefined inputs
    if (amount === null || amount === undefined) {
        return '';
    }

    // Handle Money objects (dinero.js)
    if (typeof amount === 'object' && 'getAmount' in amount) {
        const safeCurrencyCode = currencyCode || (typeof siteConfig !== 'undefined' && siteConfig?.localization?.currency) || 'CAD';
        
        return formatMoney(amount, {
            showCurrency: true,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).replace('$', safeCurrencyCode === 'CAD' ? 'CA$' : '$');
    }

    // Handle legacy number inputs (cents)
    if (typeof amount === 'number') {
        if (isNaN(amount)) {
            return '';
        }

        // Use safe defaults and fallback to siteConfig if available
        const safeCurrencyCode = currencyCode || (typeof siteConfig !== 'undefined' && siteConfig?.localization?.currency) || 'CAD';
        const safeLocale = locale || (typeof siteConfig !== 'undefined' && siteConfig?.localization?.locale) || 'en-CA';

        // Assume number is in cents, convert to dollars using money utilities
        const amountInDollars = toDollars(fromCents(amount));

        try {
            return new Intl.NumberFormat(safeLocale, {
                style: 'currency',
                currency: safeCurrencyCode,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(amountInDollars);
        } catch (error) {
            console.error('Error formatting currency:', error);
            // Fallback to simple formatting if Intl fails
            return `${safeCurrencyCode} ${amountInDollars.toFixed(2)}`;
        }
    }

    return '';
}


/**
 * Formats a given number as a percentage string with one decimal place.
 *
 * @param {number} rate - The numeric value to be formatted as a percentage.
 * @return {string} A formatted percentage string with one decimal place followed by the '%' sign.
 */
export function formatPercentage(rate: number): string {
    return `${rate.toFixed(1)}%`;
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

    const currentLocale = options?.locale || (typeof siteConfig !== 'undefined' && siteConfig?.localization?.locale) || 'en-CA';
    const formatType = options?.type || 'date'; // Default to 'date'

    try {
        // Use parseLocalDate for date-only strings (YYYY-MM-DD) to avoid timezone issues
        // Use parseISO for datetime strings with time components
        let dateObj: Date;
        let isDateOnly = false;

        if (typeof date === 'string') {
            // Check if it's a date-only string (YYYY-MM-DD format)
            if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                dateObj = parseLocalDate(date);
                isDateOnly = true;
            } else {
                // For datetime strings or other formats, use parseISO
                dateObj = parseISO(date);
            }
        } else {
            dateObj = date;
        }

        if (isNaN(dateObj.getTime())) {
            throw new Error('Invalid date value');
        }

        if (options?.formatString) {
            // Map currentLocale to a date-fns locale object for date-fns/format.
            // This is a simplified mapping; a more robust one might be needed for more locales.
            const dfnsLocale = currentLocale === 'en-CA' ? enCA : undefined;

            // For date-only formats (like 'yyyy-MM-dd'), ensure we format in local timezone
            // by manually extracting the components instead of relying on date-fns UTC interpretation
            if (isDateOnly || options.formatString === 'yyyy-MM-dd') {
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');

                // Handle common format strings manually to preserve local date
                if (options.formatString === 'yyyy-MM-dd') {
                    return `${year}-${month}-${day}`;
                }
                // For other formats, use date-fns but it should work correctly with local Date objects
            }

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

/**
 * Get today's date as a local date string (YYYY-MM-DD)
 * This avoids timezone issues when comparing with database dates
 * @param timezone Optional timezone (e.g., 'America/Vancouver'). If not provided, uses siteConfig timezone or system timezone
 * @returns Today's date in YYYY-MM-DD format in the specified timezone
 */
export function getTodayLocalDateString(timezone?: string): string {
    const tz = timezone || (typeof siteConfig !== 'undefined' && siteConfig?.businessHours?.timezone) || undefined;
    const locale = (typeof siteConfig !== 'undefined' && siteConfig?.localization?.locale) || 'en-CA';

    if (tz) {
        // Get the date in the specified timezone
        const now = new Date();
        const dateStr = now.toLocaleString(locale, { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
        // toLocaleString with en-CA returns YYYY-MM-DD format
        return dateStr.split(',')[0]; // Extract just the date part
    }

    // Fallback to system timezone
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Get the current date and time in a specific timezone as a Date object
 * The returned Date object's components (year, month, day, hour, minute, second)
 * represent the current time in the specified timezone
 * @param timezone Optional timezone (e.g., 'America/Vancouver'). If not provided, uses siteConfig timezone or system timezone
 * @returns Date object with components from the current time in the specified timezone
 */
export function getCurrentDateTimeInTimezone(timezone?: string): Date {
    const tz = timezone || (typeof siteConfig !== 'undefined' && siteConfig?.businessHours?.timezone) || undefined;

    if (tz) {
        const now = new Date();
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: tz,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }).formatToParts(now);

        const get = (type: string) => parts.find(p => p.type === type)?.value || '0';

        return new Date(
            parseInt(get('year')),
            parseInt(get('month')) - 1,
            parseInt(get('day')),
            parseInt(get('hour')),
            parseInt(get('minute')),
            parseInt(get('second'))
        );
    }

    // Fallback to server's local time
    return new Date();
}
