import { siteConfig } from "~/config/site";
import { EventService } from "~/services/event.server";

// List your public-facing static routes here
// NOTE: Only include pages that are publicly accessible without authentication
const staticRoutes = [
    "/",
    "/about",
    "/contact",
    "/classes",
    // Introductory program landing pages
    "/intro/adaptive",
    "/intro/elementary",
    "/intro/daycare",
    // Tooling page (public but non-sensitive)
    "/intro/builder",
    // DO NOT include auth pages - they create redirect chains for crawlers
    // DO NOT include /login, /register, /family/, /admin/, /instructor/
];

// Fetch public events dynamically
const getDynamicEventRoutes = async (): Promise<string[]> => {
    try {
        // Fetch upcoming public events for sitemap
        const events = await EventService.getUpcomingEvents();

        // Map to event URLs
        return events.map((event) => `/events/${event.id}`);
    } catch (error) {
        console.error('Error fetching events for sitemap:', error);
        return [];
    }
};

export async function loader() {
    const dynamicEventRoutes = await getDynamicEventRoutes();
    const allRoutes = [...staticRoutes, ...dynamicEventRoutes];

    const today = new Date().toISOString().split("T")[0];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allRoutes
    .map((route) => {
        // Determine priority and change frequency based on route type
        let priority = "0.8";
        let changefreq = "weekly";

        if (route === "/") {
            priority = "1.0";
            changefreq = "daily";
        } else if (route.startsWith("/events/")) {
            priority = "0.7";
            changefreq = "daily"; // Events change frequently
        } else if (["/about", "/contact", "/classes"].includes(route)) {
            priority = "0.9";
            changefreq = "monthly";
        } else if (route.startsWith("/intro/")) {
            priority = "0.8";
            changefreq = "monthly";
        }

        return `  <url>
    <loc>${siteConfig.url}${route}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
    })
    .join("\n")}
</urlset>`.trim();

    return new Response(sitemap, {
        status: 200,
        headers: {
            "Content-Type": "application/xml",
            "xml-stylesheet": 'type="text/xsl" href="/sitemap.xsl"', // Optional: Link to a stylesheet for browser viewing
        },
    });
}
