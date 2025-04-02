export const siteConfig = {
    location: {
        address: "650 Allandale Rd Suite A101",
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
        tiers: [
            {label: "Free Trial", description: "Your first class is on us!"},
            {label: "1st Month", price: 49},
            {label: "2nd Month", price: 100},
            {label: "Monthly", price: 121, description: "(Ongoing after 2nd month)"},
        ]
    },
    // Add other site-wide config as needed
};

export type SiteConfig = typeof siteConfig;
