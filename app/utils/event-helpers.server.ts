import { EventTypeService } from "~/services/event-type.server";

/**
 * Gets event type options for select components from database
 */
export async function getEventTypeOptions(request: Request) {
  try {
    const eventTypeService = new EventTypeService(request);
    const eventTypes = await eventTypeService.getActiveEventTypes();
    
    return eventTypes.map((eventType) => ({
      value: eventType.id,
      label: eventType.display_name
    }));
  } catch (error) {
    console.warn('Failed to fetch event types from database:', error);
    return [];
  }
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
    console.warn('Failed to fetch event type config from database:', error);
    return {};
  }
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
    
    // Fallback to neutral style if not found in database
    return "bg-gray-100 text-gray-800 border-gray-200";
  } catch (error) {
    console.warn('Failed to fetch event type color from database:', error);
    return "bg-gray-100 text-gray-800 border-gray-200";
  }
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
    console.warn('Failed to fetch event type config with dark mode from database:', error);
    return {};
  }
}
