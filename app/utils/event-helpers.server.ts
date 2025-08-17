import { Constants } from "~/types/database.types";
import { EventTypeService, type EventType } from "~/services/event-type.server";

/**
 * Converts event type enum values to user-friendly display names
 * Falls back to database display_name if available
 */
export function formatEventTypeName(eventType: string, eventTypeData?: EventType): string {
  if (eventTypeData?.display_name) {
    return eventTypeData.display_name;
  }
  
  const formatMap: Record<string, string> = {
    competition: "Competition",
    seminar: "Seminar",
    testing: "Testing",
    tournament: "Tournament",
    workshop: "Workshop",
    social_event: "Social Event",
    fundraiser: "Fundraiser",
    other: "Other",
    "belt exam": "Belt Exam"
  };
  
  return formatMap[eventType] || eventType;
}

/**
 * Gets all event types from the database enum (fallback)
 */
export function getEventTypes() {
  return Constants.public.Enums.event_type_enum;
}

/**
 * Gets event type options for select components from database
 */
export async function getEventTypeOptions(request: Request) {
  try {
    const eventTypeService = new EventTypeService(request);
    const eventTypes = await eventTypeService.getActiveEventTypes();
    
    return eventTypes.map((eventType) => ({
      value: eventType.name,
      label: eventType.display_name
    }));
  } catch (error) {
    // Fallback to enum if database fails
    console.warn('Failed to fetch event types from database, falling back to enum:', error);
    return getEventTypes().map((eventType) => ({
      value: eventType,
      label: formatEventTypeName(eventType)
    }));
  }
}

/**
 * Gets event type options for select components (sync version for client-side)
 */
export function getEventTypeOptionsSync() {
  return getEventTypes().map((eventType) => ({
    value: eventType,
    label: formatEventTypeName(eventType)
  }));
}

/**
 * Gets event type configuration with colors for badges from database
 */
export async function getEventTypeConfig(request: Request) {
  try {
    const eventTypeService = new EventTypeService(request);
    const eventTypes = await eventTypeService.getActiveEventTypes();
    
    const config: Record<string, { label: string; color: string }> = {};
    
    eventTypes.forEach((eventType) => {
      config[eventType.name] = {
        label: eventType.display_name,
        color: eventType.color_class
      };
    });
    
    return config;
  } catch (error) {
    // Fallback to hardcoded config if database fails
    console.warn('Failed to fetch event type config from database, falling back to hardcoded:', error);
    return getEventTypeConfigSync();
  }
}

/**
 * Gets event type configuration with colors for badges (sync version for client-side)
 */
export function getEventTypeConfigSync() {
  const colorMap: Record<string, string> = {
    competition: "bg-red-100 text-red-800",
    seminar: "bg-blue-100 text-blue-800",
    testing: "bg-purple-100 text-purple-800",
    tournament: "bg-orange-100 text-orange-800",
    workshop: "bg-green-100 text-green-800",
    social_event: "bg-pink-100 text-pink-800",
    fundraiser: "bg-yellow-100 text-yellow-800",
    other: "bg-gray-100 text-gray-800"
  };

  const config: Record<string, { label: string; color: string }> = {};
  
  getEventTypes().forEach((eventType) => {
    config[eventType] = {
      label: formatEventTypeName(eventType),
      color: colorMap[eventType] || "bg-gray-100 text-gray-800"
    };
  });
  
  return config;
}

/**
 * Gets event type color with border for detailed views from database
 */
export async function getEventTypeColorWithBorder(eventType: string, request: Request): Promise<string> {
  try {
    const eventTypeService = new EventTypeService(request);
    const eventTypeData = await eventTypeService.getEventTypeByName(eventType);
    
    if (eventTypeData && eventTypeData.border_class) {
      return `${eventTypeData.color_class} ${eventTypeData.border_class}`;
    }
    
    // Fallback to sync version if not found in database
    return getEventTypeColorWithBorderSync(eventType);
  } catch (error) {
    console.warn('Failed to fetch event type color from database, falling back to hardcoded:', error);
    return getEventTypeColorWithBorderSync(eventType);
  }
}

/**
 * Gets event type color with border for detailed views (sync version for client-side)
 */
export function getEventTypeColorWithBorderSync(eventType: string): string {
  const colorMap: Record<string, string> = {
    competition: "bg-red-100 text-red-800 border-red-200",
    tournament: "bg-red-100 text-red-800 border-red-200",
    testing: "bg-yellow-100 text-yellow-800 border-yellow-200",
    seminar: "bg-blue-100 text-blue-800 border-blue-200",
    workshop: "bg-blue-100 text-blue-800 border-blue-200",
    social_event: "bg-green-100 text-green-800 border-green-200",
    fundraiser: "bg-purple-100 text-purple-800 border-purple-200",
    other: "bg-gray-100 text-gray-800 border-gray-200"
  };
  
  return colorMap[eventType] || "bg-gray-100 text-gray-800 border-gray-200";
}

/**
 * Gets event type configuration with colors including dark mode variants from database
 */
export async function getEventTypeConfigWithDarkMode(request: Request) {
  try {
    const eventTypeService = new EventTypeService(request);
    const eventTypes = await eventTypeService.getActiveEventTypes();
    
    const config: Record<string, { label: string; color: string }> = {};
    
    eventTypes.forEach((eventType) => {
      const colorClass = eventType.dark_mode_class || eventType.color_class;
      config[eventType.name] = {
        label: eventType.display_name,
        color: colorClass
      };
    });
    
    return config;
  } catch (error) {
    console.warn('Failed to fetch event type config with dark mode from database, falling back to hardcoded:', error);
    return getEventTypeConfigWithDarkModeSync();
  }
}

/**
 * Gets event type configuration with colors including dark mode variants (sync version for client-side)
 */
export function getEventTypeConfigWithDarkModeSync() {
  const colorMap: Record<string, string> = {
    competition: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    seminar: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    testing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    tournament: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    workshop: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    social_event: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    fundraiser: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    other: "bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-200",
    "belt exam": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200"
  };

  const labelMap: Record<string, string> = {
    competition: "Competition",
    seminar: "Seminar",
    testing: "Testing",
    tournament: "Tournament",
    workshop: "Workshop",
    social_event: "Social Event",
    fundraiser: "Fundraiser",
    other: "Other",
    "belt exam": "Belt Exam"
  };

  const config: Record<string, { label: string; color: string }> = {};
  
  getEventTypes().forEach((eventType) => {
    config[eventType] = {
      label: labelMap[eventType] || eventType,
      color: colorMap[eventType] || colorMap.other
    };
  });

  return config;
}