import { siteConfig } from "~/config/site";
import type { Database } from "~/types/database.types";
import { parseLocalDate } from "~/components/calendar/utils";
import { formatDate } from "~/utils/misc";

// Type definitions
type Session = Database['public']['Tables']['class_sessions']['Row'];
type PartialSession = Pick<Session, 'class_id' | 'session_date' | 'start_time' | 'end_time'>;
type Program = Database['public']['Tables']['programs']['Row'];
type ClassWithSchedule = Database['public']['Tables']['classes']['Row'] & {
  class_sessions: PartialSession[];
};

// Helper function to format day names
export const formatDayName = (day: string) => {
    const dayMap: Record<string, string> = {
        'monday': 'Monday',
        'tuesday': 'Tuesday',
        'wednesday': 'Wednesday',
        'thursday': 'Thursday',
        'friday': 'Friday',
        'saturday': 'Saturday',
        'sunday': 'Sunday'
    };
    return dayMap[day.toLowerCase()] || day;
};

// Helper function to format time
export const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
};

// Helper function to calculate end time from start time and duration
export const calculateEndTime = (startTime: string, durationMinutes: number) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    
    const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
    
    return `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
};

// Get age range from programs or fallback to site config
export const getAgeRange = (programs: Program[]) => {
    if (programs.length === 0) {
        return siteConfig.classes.ageRange;
    }
    
    const ages = programs.map(p => ({min: p.min_age, max: p.max_age})).filter(a => a.min !== null && a.max !== null);
    if (ages.length === 0) {
        return siteConfig.classes.ageRange;
    }
    
    const minAge = Math.min(...ages.map(a => a.min!));
    const maxAge = Math.max(...ages.map(a => a.max!));
    return `${minAge}-${maxAge}`;
};

// Helper function to convert time from site config to 24-hour format
export const parseTimeFromSiteConfig = (timeLong: string) => {
    // Parse "5:45 PM - 7:15 PM" format
    const timeRange = timeLong.split(' - ');
    if (timeRange.length !== 2) {
        return { opens: "17:45", closes: "19:15" }; // Fallback
    }
    
    const convertTo24Hour = (time12: string) => {
        const [time, period] = time12.trim().split(' ');
        const [hours, minutes] = time.split(':');
        let hour = parseInt(hours);
        
        if (period.toUpperCase() === 'PM' && hour !== 12) {
            hour += 12;
        } else if (period.toUpperCase() === 'AM' && hour === 12) {
            hour = 0;
        }
        
        return `${hour.toString().padStart(2, '0')}:${minutes}`;
    };
    
    return {
        opens: convertTo24Hour(timeRange[0]),
        closes: convertTo24Hour(timeRange[1])
    };
};

// Get schedule information from classes and programs
export const getScheduleInfo = (classes: ClassWithSchedule[]) => {
    if (classes.length === 0) {
        console.warn('No classes found');
        return {
            days: siteConfig.classes.days,
            times: siteConfig.classes.timeLong
        };
    }
    
    // Collect all sessions from all classes
    const allSessions: PartialSession[] = [];
    classes.forEach(c => {
        if (c.class_sessions && Array.isArray(c.class_sessions)) {
            c.class_sessions.forEach((session: PartialSession) => {
                allSessions.push(session);
            });
        }
    });
    
    if (allSessions.length === 0) {
        console.warn('No sessions found');
        return {
            days: siteConfig.classes.days,
            times: siteConfig.classes.timeLong
        };
    }
    // console.log('[getScheduleInfo] allSessions', allSessions);
    
    // Group sessions by day of week
    const sessionsByDay: Record<string, { start: string; end: string }[]> = {};
    allSessions.forEach(session => {
        // Extract day of week from session_date - parse as local date to avoid timezone issues
        const sessionDate = parseLocalDate(session.session_date);
        const dayName = formatDate(sessionDate, { formatString: 'EEEE' });
        
        if (!sessionsByDay[dayName]) {
            sessionsByDay[dayName] = [];
        }
        
        if (session.start_time && session.end_time) {
            sessionsByDay[dayName].push({
                start: session.start_time,
                end: session.end_time
            });
        }
    });
    // console.log('[getScheduleInfo] sessionsByDay', sessionsByDay);
    
    // Format days and times - sort by day of week order
    const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const sortedDays = Object.keys(sessionsByDay).sort((a, b) => {
        return dayOrder.indexOf(a) - dayOrder.indexOf(b);
    });
    const days = sortedDays.join(' & ');
    
    // Get the time range (earliest start to latest end)
    const allTimes = Object.values(sessionsByDay).flat();
    if (allTimes.length > 0) {
        const earliestStart = allTimes.map(t => t.start).sort()[0];
        const latestEnd = allTimes.map(t => t.end).sort().reverse()[0];
        const times = `${formatTime(earliestStart)} - ${formatTime(latestEnd)}`;
        
        return {
            days: days || siteConfig.classes.days,
            times: times
        };
    }

    console.warn('No sessions found');
    return {
        days: siteConfig.classes.days,
        times: siteConfig.classes.timeLong
    };
};

// Helper function to generate opening hours specification for structured data
export const getOpeningHoursSpecification = (classes: ClassWithSchedule[]) => {
    if (classes.length === 0) {
        // Fallback to site config
        const dayMap: Record<string, string[]> = {
            'Tue & Thu': ['Tuesday', 'Thursday'],
            'Mon & Wed': ['Monday', 'Wednesday'],
            'Tue & Fri': ['Tuesday', 'Friday']
        };
        
        const { opens, closes } = parseTimeFromSiteConfig(siteConfig.classes.timeLong);
        
        return [{
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": dayMap[siteConfig.classes.days] || ["Tuesday", "Thursday"],
            "opens": opens,
            "closes": closes
        }];
    }
    
    // Collect all sessions from all classes
    const allSessions: PartialSession[] = [];
    classes.forEach(c => {
        if (c.class_sessions && Array.isArray(c.class_sessions)) {
            c.class_sessions.forEach((session: PartialSession) => {
                allSessions.push(session);
            });
        }
    });
    
    if (allSessions.length === 0) {
        const { opens, closes } = parseTimeFromSiteConfig(siteConfig.classes.timeLong);
        const dayMap: Record<string, string[]> = {
            'Tue & Thu': ['Tuesday', 'Thursday'],
            'Mon & Wed': ['Monday', 'Wednesday'],
            'Tue & Fri': ['Tuesday', 'Friday']
        };
        
        return [{
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": dayMap[siteConfig.classes.days] || ["Tuesday", "Thursday"],
            "opens": opens,
            "closes": closes
        }];
    }
    
    // Group sessions by day of week
    const sessionsByDay: Record<string, { start: string; end: string }[]> = {};
    allSessions.forEach(session => {
        // Extract day of week from session_date - parse as local date to avoid timezone issues
        const sessionDate = parseLocalDate(session.session_date);
        const dayName = formatDate(sessionDate, { formatString: 'EEEE' });
        
        if (!sessionsByDay[dayName]) {
            sessionsByDay[dayName] = [];
        }
        
        if (session.start_time && session.end_time) {
            sessionsByDay[dayName].push({
                start: session.start_time,
                end: session.end_time
            });
        }
    });
    
    // Convert to opening hours specification
    return Object.entries(sessionsByDay).map(([day, timeSlots]) => {
        const startTimes = timeSlots.map(slot => slot.start);
        const endTimes = timeSlots.map(slot => slot.end);
        
        const earliestStart = startTimes.sort()[0];
        const latestEnd = endTimes.sort().reverse()[0];
        
        return {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": [day],
            "opens": earliestStart,
            "closes": latestEnd
        };
    });
};

// Fallback schedule info for components that don't have access to dynamic data
export const getFallbackScheduleInfo = () => ({
    days: siteConfig.classes.days,
    times: siteConfig.classes.timeLong,
    ageRange: siteConfig.classes.ageRange
});