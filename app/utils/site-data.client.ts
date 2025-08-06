import { siteConfig } from "~/config/site";
import type { SiteData } from "~/utils/site-data.server";

/**
 * Client-side site data utility for components that don't have server access
 * This provides a consistent interface for accessing site data
 */

// Client-side cache for site data received from loaders
let clientSiteDataCache: SiteData | null = null;

/**
 * Set site data in client-side cache (called from layout loader)
 * Handles Date deserialization from JSON
 */
export function setSiteData(data: SiteData | any): void {
  // Handle Date deserialization if needed
  if (data.lastUpdated && typeof data.lastUpdated === 'string') {
    data.lastUpdated = new Date(data.lastUpdated);
  }
  console.log("setSiteData",data);
  clientSiteDataCache = data as SiteData;
}

/**
 * Get site data for client components
 * Falls back to static config if no dynamic data is available
 */
export function getSiteData(): SiteData {
  if (clientSiteDataCache) {
    return clientSiteDataCache;
  }

  // Fallback to static config
  console.warn('SSR: Using fallback site data');
  return {
    schedule: {
      days: siteConfig.classes.days,
      times: siteConfig.classes.timeLong,
      ageRange: siteConfig.classes.ageRange,
    },
    contact: {
      phone: siteConfig.contact.phone,
      email: siteConfig.contact.email,
      address: siteConfig.location.address,
      locality: siteConfig.location.locality,
      region: siteConfig.location.region,
      postalCode: siteConfig.location.postalCode,
    },
    business: {
    name: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    socials: {
      facebook: siteConfig.socials.facebook,
      instagram: siteConfig.socials.instagram,
    },
  },
    openingHours: [{
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Tuesday", "Thursday"],
      "opens": "17:45",
      "closes": "19:15"
    }],
    lastUpdated: new Date(),
  };
}

/**
 * Check if we're running on the server
 */
function isServer() {
  return typeof window === 'undefined';
}

/**
 * Get schedule information specifically
 */
export function getScheduleData() {
  // During SSR, always use fallback data
  if (isServer()) {
    console.warn('SSR: Using fallback schedule data');
    return {
      days: siteConfig.classes.days,
      times: siteConfig.classes.timeLong,
      ageRange: siteConfig.classes.ageRange,
    };
  }
  
  const siteData = getSiteData();
  console.log("getScheduleData",siteData.schedule);
  return siteData.schedule;
}

/**
 * Get contact information specifically
 */
export function getContactData() {
  // During SSR, always use fallback data
  if (isServer()) {
    return {
      phone: siteConfig.contact.phone,
      email: siteConfig.contact.email,
      address: siteConfig.location.address,
      locality: siteConfig.location.locality,
      region: siteConfig.location.region,
      postalCode: siteConfig.location.postalCode,
    };
  }
  
  const siteData = getSiteData();
  return siteData.contact;
}

/**
 * Get business information specifically
 */
export function getBusinessData() {
  // During SSR, always use fallback data
  if (isServer()) {
    return {
      name: siteConfig.name,
      description: siteConfig.description,
      url: siteConfig.url,
      socials: {
        facebook: siteConfig.socials.facebook,
        instagram: siteConfig.socials.instagram,
      },
    };
  }
  
  const siteData = getSiteData();
  return siteData.business;
}

/**
 * Clear client-side cache
 */
export function clearClientSiteDataCache(): void {
  clientSiteDataCache = null;
}