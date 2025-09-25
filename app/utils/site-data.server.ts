import { getSupabaseAdminClient } from "~/utils/supabase.server";
import { siteConfig } from "~/config/site";
import { getScheduleInfo, getAgeRange, getOpeningHoursSpecification } from "~/utils/schedule";
import { DEFAULT_SCHEDULE, getDefaultAgeRangeLabel } from "~/constants/schedule";
import type { Database } from "~/types/database.types";

// Type definitions
type Program = Database['public']['Tables']['programs']['Row'];
type ClassWithSchedule = Database['public']['Tables']['classes']['Row'] & {
  class_sessions: Array<{
    class_id: string;
    session_date: string;
    start_time: string;
    end_time: string;
  }>;
};

export interface SiteData {
  schedule: {
    days: string;
    times: string;
    ageRange: string;
  };
  contact: {
    phone: string;
    email: string;
    address: string;
    locality: string;
    region: string;
    postalCode: string;
  };
  business: {
    name: string;
    description: string;
    url: string;
    socials: {
      facebook?: string;
      instagram?: string;
      youtube?: string;
    };
  };
  openingHours: Array<{
    "@type": string;
    dayOfWeek: string[];
    opens: string;
    closes: string;
  }>;
  lastUpdated: Date;
}

// In-memory cache for site data
let siteDataCache: SiteData | null = null;
let cacheExpiry: Date | null = null;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get comprehensive site data with dynamic schedule information
 * Uses caching to avoid repeated database queries
 */
export async function getSiteData(forceRefresh = false): Promise<SiteData> {
  // Return cached data if valid and not forcing refresh
  if (!forceRefresh && isCacheValid()) {
    console.log("[getSiteData] using cache");
    return siteDataCache!; // Non-null assertion: isCacheValid() ensures siteDataCache is not null
  }

  try {
    // Fetch dynamic data from database
    const dynamicData = await fetchDynamicSiteData();
    
    // Create comprehensive site data object
    const siteData: SiteData = {
      schedule: dynamicData.schedule,
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
      openingHours: dynamicData.openingHours,
      lastUpdated: new Date(),
    };

    // Update cache
    // console.log("[getSiteData] updating cache",siteData);
    siteDataCache = siteData;
    cacheExpiry = new Date(Date.now() + CACHE_DURATION_MS);

    return siteData;
  } catch (error) {
    console.error('Error fetching site data:', error);
    
    // Return fallback data based on static config
    return getFallbackSiteData();
  }
}

/**
 * Fetch dynamic schedule and program data from database
 */
async function fetchDynamicSiteData() {
  const supabase = getSupabaseAdminClient();

  // Fetch active classes with schedules and programs
  const { data: classes, error: classesError } = await supabase
    .from('classes')
    .select(`
      *,
      class_sessions (
        class_id,
        session_date,
        start_time,
        end_time
      )
    `)
    .eq('is_active', true);

  if (classesError) {
    console.error('Error fetching classes:', classesError);
    throw classesError;
  }
  // console.log("[fetchDynamicSiteData] classes",classes);

  const { data: programs, error: programsError } = await supabase
    .from('programs')
    .select('*')
    .eq('is_active', true);

  if (programsError) {
    console.error('Error fetching programs:', programsError);
    throw programsError;
  }
  // console.log("[fetchDynamicSiteData] programs",programs);

  const classesWithSchedules = classes as ClassWithSchedule[];
  const activePrograms = programs as Program[];

  // Generate schedule information
  const scheduleInfo = getScheduleInfo(classesWithSchedules);
  const ageRange = getAgeRange(activePrograms);
  const openingHours = getOpeningHoursSpecification(classesWithSchedules);

  return {
    schedule: {
      days: scheduleInfo.days,
      times: scheduleInfo.times,
      ageRange: ageRange,
    },
    openingHours: openingHours,
  };
}

/**
 * Get fallback site data when dynamic data is unavailable
 */
function getFallbackSiteData(): SiteData {
  return {
    schedule: {
      days: DEFAULT_SCHEDULE.days,
      times: DEFAULT_SCHEDULE.timeRange,
      ageRange: getDefaultAgeRangeLabel(),
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
      "dayOfWeek": DEFAULT_SCHEDULE.days.split(' & ').map(day => day.trim()),
      "opens": DEFAULT_SCHEDULE.opens,
      "closes": DEFAULT_SCHEDULE.closes
    }],
    lastUpdated: new Date(),
  };
}

/**
 * Clear the site data cache (useful for testing or when data changes)
 */
export function clearSiteDataCache(): void {
  siteDataCache = null;
  cacheExpiry = null;
}

/**
 * Get cached site data without database query (for client-side components)
 * Returns null if no cache exists
 */
export function getCachedSiteData(): SiteData | null {
  if (isCacheValid()) {
    return siteDataCache;
  }
  return null;
}

/**
 * Check if site data cache is valid
 */
export function isCacheValid(): boolean {
  return siteDataCache !== null && cacheExpiry !== null && new Date() < cacheExpiry;
}
