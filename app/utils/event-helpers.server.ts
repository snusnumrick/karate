import { EventTypeService } from "~/services/event-type.server";
import { getSupabaseAdminClient } from "~/utils/supabase.server";

type EventTypeConfig = Record<string, { label: string; color: string }>;

const EVENT_TYPE_CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let eventTypeConfigCache: { data: EventTypeConfig; expiresAt: number } | null = null;
let eventTypeConfigInflight: Promise<EventTypeConfig> | null = null;

function buildEventTypeConfig(eventTypes: Array<{
  name: string;
  display_name: string;
  color_class: string | null;
  dark_mode_class: string | null;
}>): EventTypeConfig {
  const config: EventTypeConfig = {};

  eventTypes.forEach((eventType) => {
    const colorClass = eventType.dark_mode_class || eventType.color_class || '';
    config[eventType.name] = {
      label: eventType.display_name,
      color: colorClass
    };
  });

  return config;
}

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
  const now = Date.now();

  if (eventTypeConfigCache && eventTypeConfigCache.expiresAt > now) {
    return eventTypeConfigCache.data;
  }

  if (eventTypeConfigInflight) {
    return eventTypeConfigInflight;
  }

  eventTypeConfigInflight = (async (): Promise<EventTypeConfig> => {
    try {
      const supabaseAdmin = getSupabaseAdminClient();
      const { data, error } = await supabaseAdmin
        .from('event_types')
        .select('name, display_name, color_class, dark_mode_class')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        throw error;
      }

      const config = buildEventTypeConfig(data || []);
      eventTypeConfigCache = {
        data: config,
        expiresAt: Date.now() + EVENT_TYPE_CONFIG_CACHE_TTL
      };

      return config;
    } catch (error) {
      console.warn('Failed to fetch event types via admin client; falling back to request-scoped client.', error);

      try {
        const eventTypeService = new EventTypeService(request);
        const eventTypes = await eventTypeService.getActiveEventTypes();
        const config = buildEventTypeConfig(eventTypes);
        eventTypeConfigCache = {
          data: config,
          expiresAt: Date.now() + EVENT_TYPE_CONFIG_CACHE_TTL
        };
        return config;
      } catch (fallbackError) {
        console.warn('Fallback fetch for event type config failed:', fallbackError);
        return {};
      }
    } finally {
      eventTypeConfigInflight = null;
    }
  })();

  return eventTypeConfigInflight;
}
