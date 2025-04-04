// Ensure VITE_SITE_URL is defined in your environment variables (.env file)
// Vite exposes env variables prefixed with VITE_ on `import.meta.env`
const siteUrl = import.meta.env.SITE_URL || 'http://localhost:3000'; // Fallback for local dev if not set

export const siteConfig = {
    name: "Greenegin Karate", // Added site name
    description: "Kids Karate Classes in Colwood, BC. Learn discipline, respect, and self-defense with Sensei Negin. Ages 6-12. Free trial available!", // Added default description
    url: siteUrl, // Use the environment variable
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
        time: "6:15 - 7:15 p.m",
        timeLong: "6:15 PM - 7:15 PM", // For more formal display
        ageRange: "6-12 y/o",
    },
    socials: {
        instagram: "https://www.instagram.com/greenegin.karate/",
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
        tiers: [
            {label: "Free Trial", description: "Your first class is on us!"},
            {label: "1st Month", price: 49},
            {label: "2nd Month", price: 100},
            {label: "Monthly", price: 121, description: "(Ongoing after 2nd month)"},
            // Optional: Add yearly/session info here if needed for display elsewhere
            {label: "Yearly Membership", price: 1200, description: "(Paid Annually)"},
            {label: "1:1 Session", price: 80, description: "(Per Session)"},
        ]
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
    // Add other site-wide config as needed
};

export type SiteConfig = typeof siteConfig;
