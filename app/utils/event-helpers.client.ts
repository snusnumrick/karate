/**
 * Converts event type enum values to user-friendly display names
 * Client-safe version without server dependencies
 */
export function formatEventTypeName(eventType: string): string {
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
 * Gets default event type names (fallback when database is unavailable)
 */
function getDefaultEventTypes() {
  return [
    'competition',
    'seminar', 
    'testing',
    'tournament',
    'workshop',
    'social_event',
    'fundraiser',
    'belt_exam',
    'other'
  ];
}

/**
 * Gets event type options for select components (sync version)
 */
export function getEventTypeOptionsSync() {
  return getDefaultEventTypes().map((eventType) => ({
    value: eventType,
    label: formatEventTypeName(eventType)
  }));
}

/**
 * Gets event type configuration with colors (sync version for client-side)
 */
export function getEventTypeConfigSync() {
  const colorMap: Record<string, string> = {
    competition: "bg-red-100 text-red-800",
    tournament: "bg-red-100 text-red-800",
    testing: "bg-yellow-100 text-yellow-800",
    seminar: "bg-blue-100 text-blue-800",
    workshop: "bg-blue-100 text-blue-800",
    social_event: "bg-green-100 text-green-800",
    fundraiser: "bg-purple-100 text-purple-800",
    other: "bg-gray-100 text-gray-800"
  };
  
  return getDefaultEventTypes().map((eventType) => ({
    name: eventType,
    display_name: formatEventTypeName(eventType),
    color_class: colorMap[eventType] || "bg-gray-100 text-gray-800"
  }));
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
 * Gets event type configuration with colors including dark mode variants (sync version)
 */
export function getEventTypeConfigWithDarkModeSync() {
  const colorMap: Record<string, { light: string; dark: string }> = {
    competition: {
      light: "bg-red-100 text-red-800",
      dark: "dark:bg-red-900/20 dark:text-red-400"
    },
    tournament: {
      light: "bg-red-100 text-red-800",
      dark: "dark:bg-red-900/20 dark:text-red-400"
    },
    testing: {
      light: "bg-yellow-100 text-yellow-800",
      dark: "dark:bg-yellow-900/20 dark:text-yellow-400"
    },
    seminar: {
      light: "bg-blue-100 text-blue-800",
      dark: "dark:bg-blue-900/20 dark:text-blue-400"
    },
    workshop: {
      light: "bg-blue-100 text-blue-800",
      dark: "dark:bg-blue-900/20 dark:text-blue-400"
    },
    social_event: {
      light: "bg-green-100 text-green-800",
      dark: "dark:bg-green-900/20 dark:text-green-400"
    },
    fundraiser: {
      light: "bg-purple-100 text-purple-800",
      dark: "dark:bg-purple-900/20 dark:text-purple-400"
    },
    other: {
      light: "bg-gray-100 text-gray-800",
      dark: "dark:bg-gray-800 dark:text-gray-300"
    }
  };
  
  return getDefaultEventTypes().map((eventType) => {
    const colors = colorMap[eventType] || colorMap.other;
    return {
      name: eventType,
      display_name: formatEventTypeName(eventType),
      color_class: `${colors.light} ${colors.dark}`
    };
  });
}