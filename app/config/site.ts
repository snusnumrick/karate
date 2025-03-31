
export const siteConfig = {
  location: {
    address: "650 Allandale Rd Suite A101",
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
  // Add other site-wide config as needed
};

export type SiteConfig = typeof siteConfig;
