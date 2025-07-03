// Ensure VITE_SITE_URL is defined in your environment variables (.env file)
// Vite exposes env variables prefixed with VITE_ on `import.meta.env`
const siteUrl = import.meta.env.VITE_SITE_URL || 'http://localhost:5173'; // Fallback for local dev if not set

export const siteConfig = {
    name: "GREENEGIN KARATE", // Added site name
    description: "Kids Karate Classes in Langford, BC. Learn discipline, respect, and self-defense with Sensei Negin. Free trial available!", // Added default description
    url: siteUrl, // Use the environment variable
    locale: 'en-CA', // Default locale for the site
    location: {
        address: "650 Allandale Rd Suite A101",
        locality: "Victoria",
        region: "BC",
        postalCode: "V9C 0S2", // Add postal code
        country: "CA",
        description: " our Colwood studio",
        // Add other location details if needed, e.g., map link
    },
    contact: {
        phone: "(604) 690-7121",
        email: "info@greenegin.ca",
    },
    classes: {
        days: "Tue & Fri",
        time: "5:45 - 7:15 p.m",
        timeLong: "5:45 PM - 7:15 PM", // For more formal display
        ageRange: "4-12",
    },
    socials: {
        instagram: "https://www.instagram.com/greenegin.karate/",
        facebook: "https://www.facebook.com/greenegin.karate/",
    },
    pricing: {
        currency: "$",
        currencyCode: "CAD", // Optional: For more specific contexts
        freeTrial: "FREE TRIAL",
        firstMonth: 49,
        secondMonth: 100,
        monthly: 121,
        yearly: 1200, // Example yearly price (e.g., ~10% discount)
        oneOnOneSession: 80, // Example price for a single 1:1 session
        // taxRateBC removed - Tax rates are now managed in the database (tax_rates table)
        // Define applicable tax *names* (matching tax_rates table) for the region/site
        // This example assumes BC taxes apply site-wide. Adjust logic if region-specific taxes are needed.
        // applicableTaxNames: ['GST', 'PST_BC'],
        applicableTaxNames: ['PST_BC'],
        get tiers(): { label: string; description: string }[] {
            return [
                {label: "Free Trial", description: "Your first class is on us!"},
                {label: "1st Month", description: `(${this.currency}${this.firstMonth})`}, // Display price from main config
                {label: "2nd Month", description: `(${this.currency}${this.secondMonth})`}, // Display price from main config
                {label: "Monthly", description: `(${this.currency}${this.monthly} - Ongoing)`}, // Display price from main config
                {label: "Yearly Membership", description: `(${this.currency}${this.yearly} - Paid Annually)`}, // Display price from main config
                {label: "1:1 Session", description: `(${this.currency}${this.oneOnOneSession} - Per Session)`}, // Display price from main config
            ];
        }
    },
    stripe: {
        // Replace with your actual Stripe Price IDs from your Stripe Dashboard (Test or Live)
        priceIds: {
            firstMonth: 'price_1RA2PJPbU9pROzQRCCSzYnNS', // Replace with the actual ID for $49 price
            secondMonth: 'price_1RA2PJPbU9pROzQRS6Iwa59M', // Replace with the actual ID for $100 price
            monthly: 'price_1RA2PJPbU9pROzQRbfS2BBcw', // Replace with the actual ID for $121 price
            yearly: 'price_1RA2RnPbU9pROzQRdATPqVhf', // Replace with the actual ID for $1200 price
            oneOnOneSession: 'price_1RA2TNPbU9pROzQRdxViZv5P', // Replace with the actual ID for $80 price
        }
    },
    // Define province options centrally
    provinces: [
        { value: "AB", label: "Alberta" },
        { value: "BC", label: "British Columbia" },
        { value: "MB", label: "Manitoba" },
        { value: "NB", label: "New Brunswick" },
        { value: "NL", label: "Newfoundland and Labrador" },
        { value: "NS", label: "Nova Scotia" },
        { value: "ON", label: "Ontario" },
        { value: "PE", label: "Prince Edward Island" },
        { value: "QC", label: "Quebec" },
        { value: "SK", label: "Saskatchewan" },
        { value: "NT", label: "Northwest Territories" },
        { value: "NU", label: "Nunavut" },
        { value: "YT", label: "Yukon" },
    ],
    // Add other site-wide config as needed
};

export type SiteConfig = typeof siteConfig;
