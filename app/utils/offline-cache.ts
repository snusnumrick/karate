/**
 * Offline cache utility for storing and retrieving family dashboard data
 */

// Cache keys
const CACHE_KEYS = {
  FAMILY_DATA: 'family_data',
  FAMILY_TIMESTAMP: 'family_timestamp',
  UPCOMING_CLASSES: 'upcoming_classes',
  UPCOMING_CLASSES_TIMESTAMP: 'upcoming_classes_timestamp',
  ATTENDANCE_DATA: 'attendance_data',
  ATTENDANCE_TIMESTAMP: 'attendance_timestamp',
  CACHE_STATUS: 'cache_status',
} as const;

// Cache expiry time (24 hours)
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000;

// Type definitions for cached data
export interface CachedFamilyData {
  family: {
    id: string;
    name: string;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    postal_code?: string | null;
    primary_phone?: string;
    email?: string;
    students?: Array<{
      id: string;
      first_name: string;
      last_name: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  };
  allWaiversSigned: boolean;
  timestamp: number;
}

export interface CachedSession {
  student_name: string;
  class_name: string;
  instructor_name?: string;
  session_date: string;
  start_time: string;
  end_time: string;
}

export interface CachedAttendanceRecord {
  student_id: string;
  student_name: string;
  last_session_date?: string;
  attendance_status?: 'Present' | 'Absent' | 'Excused' | 'Late';
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Check if cached data is still valid
 */
function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_DURATION;
}

/**
 * Store family data in localStorage
 */
export function cacheFamilyData(data: { family: CachedFamilyData['family']; allWaiversSigned: boolean }): void {
  try {
    const cacheData: CachedFamilyData = {
      ...data,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEYS.FAMILY_DATA, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to cache family data:', error);
  }
}

/**
 * Retrieve cached family data if valid
 */
export function getCachedFamilyData(): CachedFamilyData | null {
  try {
    const dataStr = localStorage.getItem(CACHE_KEYS.FAMILY_DATA);
    if (!dataStr) return null;

    const data = JSON.parse(dataStr) as CachedFamilyData;
    if (!isCacheValid(data.timestamp)) {
      clearFamilyCache();
      return null;
    }

    return data;
  } catch (error) {
    console.warn('Failed to retrieve cached family data:', error);
    return null;
  }
}

/**
 * Store upcoming classes data
 */
export function cacheUpcomingClasses(classes: CachedSession[]): void {
  try {
    const cacheData = {
      classes,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEYS.UPCOMING_CLASSES, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to cache upcoming classes:', error);
  }
}

/**
 * Retrieve cached upcoming classes
 */
export function getCachedUpcomingClasses(): CachedSession[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.UPCOMING_CLASSES);
    if (!cached) return null;
    
    const data = JSON.parse(cached) as { classes: CachedSession[]; timestamp: number };
    
    // Check if cache is expired
    if (Date.now() - data.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(CACHE_KEYS.UPCOMING_CLASSES);
      return null;
    }
    
    return data.classes;
  } catch (error) {
    console.warn('Failed to retrieve cached upcoming classes:', error);
    return null;
  }
}

/**
 * Store attendance data
 */
export function cacheAttendanceData(data: CachedAttendanceRecord[]): void {
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(CACHE_KEYS.ATTENDANCE_DATA, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to cache attendance data:', error);
  }
}

/**
 * Retrieve cached attendance data
 */
export function getCachedAttendanceData(): CachedAttendanceRecord[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEYS.ATTENDANCE_DATA);
    if (!cached) return null;
    
    const data = JSON.parse(cached) as { data: CachedAttendanceRecord[]; timestamp: number };
    
    // Check if cache is expired
    if (Date.now() - data.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(CACHE_KEYS.ATTENDANCE_DATA);
      return null;
    }
    
    return data.data;
  } catch (error) {
    console.warn('Failed to retrieve cached attendance data:', error);
    return null;
  }
}

/**
 * Clear all family-related cache
 */
export function clearFamilyCache(): void {
  try {
    Object.values(CACHE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.warn('Failed to clear family cache:', error);
  }
}

/**
 * Check if we're currently offline
 */
export function isOffline(): boolean {
  return !navigator.onLine;
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus(): {
  hasFamilyData: boolean;
  hasUpcomingClasses: boolean;
  hasAttendanceData: boolean;
  cacheAge: number | null;
  isValid: boolean;
} {
  const timestampStr = localStorage.getItem(CACHE_KEYS.FAMILY_TIMESTAMP);
  const timestamp = timestampStr ? parseInt(timestampStr, 10) : null;
  const cacheAge = timestamp ? Date.now() - timestamp : null;
  
  return {
    hasFamilyData: !!localStorage.getItem(CACHE_KEYS.FAMILY_DATA),
    hasUpcomingClasses: !!localStorage.getItem(CACHE_KEYS.UPCOMING_CLASSES),
    hasAttendanceData: !!localStorage.getItem(CACHE_KEYS.ATTENDANCE_DATA),
    cacheAge,
    isValid: timestamp ? isCacheValid(timestamp) : false,
  };
}