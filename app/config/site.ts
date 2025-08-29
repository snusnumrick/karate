// Ensure VITE_SITE_URL is defined in your environment variables (.env file)
// Vite exposes env variables prefixed with VITE_ on `import.meta.env`
const siteUrl = import.meta.env.VITE_SITE_URL || 'http://localhost:5178'; // Fallback for local dev if not set

export const siteConfig = {
    name: "GREENEGIN KARATE", // Added site name
    description: "Kids Karate Classes in Langford, BC. Learn discipline, respect, and self-defense with Sensei Negin. Free trial available!", // Added default description
    url: siteUrl, // Use the environment variable
    // SEO and Meta Configuration
    seo: {
        keywords: [
            "karate classes",
            "kids martial arts",
            "children karate",
            "Langford BC",
            "Victoria BC",
            "self-defense",
            "discipline training",
            "youth karate",
            "martial arts school",
            "Sensei Negin"
        ],
        author: "Sensei Negin",
        robots: "index, follow",
        googleSiteVerification: "a5438f604752dea3", // From googlea5438f604752dea3.html
        openGraph: {
            type: "website",
            siteName: "GREENEGIN KARATE",
            locale: "en_CA",
        },
        twitter: {
            card: "summary_large_image",
            site: "@greenegin_karate", // Add if Twitter account exists
        },
        structuredData: {
            organizationType: "SportsOrganization",
            businessType: "Martial Arts School",
            priceRange: "$",
            paymentAccepted: ["Cash", "Credit Card", "Debit Card", "Online Payment"],
            currenciesAccepted: "CAD",
        }
    },
    // Localization settings
    localization: {
        locale: 'en-CA', // Primary locale
        currency: 'CAD', // Currency code
        country: 'CA', // Country code for formatting/display logic (dates, numbers, etc.)
        pageSize: 'A4', // PDF page size based on region (A4 for Canada/international, LETTER for US)
        // Alternative locales for fallback or specific use cases
        fallbackLocale: 'en-US',
    },
    location: {
        address: "650 Allandale Rd Suite A101",
        locality: "Victoria",
        region: "BC",
        postalCode: "V9C 0S2", // Add postal code
        country: "CA", // Physical location country for address/contact purposes
        description: " our Colwood studio",
        // Add other location details if needed, e.g., map link
    },
    contact: {
        phone: "(604) 690-7121",
        email: "info@karate.greenegin.ca",
        paymentsEmail: "payments@karate.greenegin.ca",
    },
    classes: {
        days: "Tue & Thu",
        time: "5:45 - 7:15 p.m",
        timeLong: "5:45 PM - 7:15 PM", // For more formal display
        ageRange: "4-12",
        duration: "90 minutes", // Class duration
        maxStudents: 15, // Maximum students per class
        minAge: 4,
        maxAge: 12,
    },
    // Business Hours
    businessHours: {
        timezone: "America/Vancouver", // Pacific Time
        classes: {
            tuesday: { open: "17:45", close: "19:15", closed: false },
            thursday: { open: "17:45", close: "19:15", closed: false },
        }
    },
    // Instructor Information
    instructor: {
        name: "Sensei Negin",
        title: "Head Instructor",
        rank: "5th Dan Black Belt",
        experience: "15+ years",
        specializations: [
            "Children's Martial Arts",
            "Character Development",
            "Self-Defense",
            "Traditional Karate"
        ],
        bio: "Sensei Negin brings over 15 years of martial arts experience and specializes in teaching children the values of discipline, respect, and self-confidence through traditional karate training.",
    },
    // Program Information
    programs: {
        mainProgram: {
            name: "Youth Karate Program",
            description: "Traditional karate training focused on character development, self-defense, and physical fitness for children.",
            benefits: [
                "Improved discipline and focus",
                "Enhanced self-confidence",
                "Physical fitness and coordination",
                "Self-defense skills",
                "Respect and character building",
                "Goal setting and achievement"
            ],
            curriculum: [
                "Basic karate techniques",
                "Forms (Kata)",
                "Self-defense applications",
                "Character development",
                "Belt progression system"
            ]
        }
    },
    socials: {
        instagram: "https://www.instagram.com/greenegin.karate/",
        facebook: "https://www.facebook.com/greenegin.karate/",
        // youtube: "", // Add if YouTube channel exists
        // tiktok: "", // Add if TikTok account exists
    },
    // Facility Information
    facility: {
        name: "Colwood Studio",
        type: "Martial Arts Dojo",
        features: [
            "Professional training mats",
            "Spacious training area",
            "Changing rooms",
            "Viewing area for parents",
            "Air conditioning",
            "Sound system"
        ],
        accessibility: [
            "Wheelchair accessible entrance",
            "Accessible parking",
            "Ground floor location"
        ],
        safety: [
            "First aid kit on premises",
            "Emergency procedures posted",
            "Trained instructor in CPR",
            "Secure entry system"
        ]
    },
    // Emergency and Additional Contacts
    emergencyContact: {
        primary: {
            name: "Sensei Negin",
            phone: "(604) 690-7121",
            email: "info@karate.greenegin.ca",
            role: "Head Instructor"
        },
        // backup: {
        //     name: "",
        //     phone: "",
        //     email: "",
        //     role: "Assistant Instructor"
        // }
    },
    // Legal and Business Information
    legal: {
        businessName: "GREENEGIN KARATE",
        address: "989 Iota Pl., Langford, BC V9C3T1, Canada",
        // businessNumber: "", // Add if needed for tax purposes
        // gstNumber: "", // Add GST number if applicable
        insuranceProvider: "Sport & Fitness Insurance",
        waiverRequired: true,
        privacyPolicyUrl: "/privacy-policy", // Add when privacy policy page exists
        termsOfServiceUrl: "/terms-of-service", // Add when terms page exists
    },
    pricing: {
        currency: "$",
        currencyCode: "CAD", // Optional: For more specific contexts
        freeTrial: "FREE TRIAL",
        monthly: 121,
        yearly: 1200, // Example yearly price (e.g., ~10% discount)
        oneOnOneSession: 80, // Example price for a single 1:1 session
        // taxRateBC removed - Tax rates are now managed in the database (tax_rates table)
        // Define applicable tax *names* (matching tax_rates table) for the region/site
        // This example assumes BC taxes apply site-wide. Adjust logic if region-specific taxes are needed.
        // applicableTaxNames: ['GST', 'PST_BC'],
        // applicableTaxNames: ['PST_BC'],
        get tiers(): { label: string; description: string }[] {
            return [
                {label: "Free Trial", description: "Your first class is on us!"},
                {label: "Monthly", description: `(${this.currency}${this.monthly} - Ongoing)`}, // Display price from main config
                {label: "Yearly Membership", description: `(${this.currency}${this.yearly} - Paid Annually)`}, // Display price from main config
                {label: "1:1 Session", description: `(${this.currency}${this.oneOnOneSession} - Per Session)`}, // Display price from main config
            ];
        }
    },
    stripe: {
        // Replace with your actual Stripe Price IDs from your Stripe Dashboard (Test or Live)
        priceIds: {
            monthly: 'price_1RA2PJPbU9pROzQRbfS2BBcw', // Replace with the actual ID for $121 price
            yearly: 'price_1RA2RnPbU9pROzQRdATPqVhf', // Replace with the actual ID for $1200 price
            oneOnOneSession: 'price_1RA2TNPbU9pROzQRdxViZv5P', // Replace with the actual ID for $80 price
        }
    },
    // Define province options centrally
    provinces: [
        {value: "AB", label: "Alberta"},
        {value: "BC", label: "British Columbia"},
        {value: "MB", label: "Manitoba"},
        {value: "NB", label: "New Brunswick"},
        {value: "NL", label: "Newfoundland and Labrador"},
        {value: "NS", label: "Nova Scotia"},
        {value: "ON", label: "Ontario"},
        {value: "PE", label: "Prince Edward Island"},
        {value: "QC", label: "Quebec"},
        {value: "SK", label: "Saskatchewan"},
        {value: "NT", label: "Northwest Territories"},
        {value: "NU", label: "Nunavut"},
        {value: "YT", label: "Yukon"},
    ],
    // AI Models configuration
    ai: {
        models: {
            primary: "gemini-2.5-pro",
            backup: "gemini-1.5-pro",
            summary: "gemini-2.0-flash"
        }
    },
    // Territory Acknowledgement
    territoryAcknowledgement: {
        title: "Territory Acknowledgement",
        text: "At Greenegin Karate, we acknowledge we live, work, and train on the traditional, unceded territories of the Lekwungen-speaking Peoples, including the Songhees and Esquimalt Nations. We are grateful for their care of this territory and honour their ongoing connection to it. As martial artists, we commit to respect, humility, and integrity in our relationships with this territory and its peoples."
    },
    // Analytics and Tracking
    analytics: {
        // googleAnalyticsId: "", // Add GA4 tracking ID when available
        // facebookPixelId: "", // Add Facebook Pixel ID if using Facebook ads
        // hotjarId: "", // Add Hotjar ID for user behavior analytics
        enableCookieConsent: true,
        enablePerformanceTracking: true,
    },
    // Performance and Technical Configuration
    performance: {
        enableServiceWorker: true,
        enablePWA: true,
        cacheStrategy: "networkFirst", // or "cacheFirst"
        offlineSupport: true,
        enablePushNotifications: true,
        enableWebVitals: true,
    },
    // Brand Colors
    colors: {
        primary: "#469a45", // Company green color
    },
    // Feature Flags
    features: {
        enableOnlinePayments: true,
        enableClassBooking: true,
        enableMessaging: true,
        enableCalendarIntegration: true,
        enableMultiLanguage: false, // Set to true when multiple languages are supported
        enableDarkMode: true,
        enablePrintInvoices: true,
        enableBulkOperations: true,
        enableAdvancedReporting: true,
        enableAPIAccess: false, // For future API integrations
    },
    // Content Management
    content: {
        maxFileUploadSize: 5 * 1024 * 1024, // 5MB in bytes
        allowedFileTypes: ['.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx'],
        defaultPageSize: 10, // For pagination
        maxSearchResults: 50,
        sessionTimeout: 30 * 60 * 1000, // 30 minutes in milliseconds
    },
    // Notification Settings
    notifications: {
        enableEmailNotifications: true,
        enableSMSNotifications: false, // Set to true when SMS service is configured
        enablePushNotifications: true,
        defaultNotificationPreferences: {
            classReminders: true,
            paymentReminders: true,
            announcements: true,
            promotions: false,
        }
    }
};

export type SiteConfig = typeof siteConfig;
