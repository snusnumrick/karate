import { type LoaderFunctionArgs } from "@remix-run/node";
import { siteConfig } from "~/config/site"; // Import siteConfig

// List your public-facing static routes here
const staticRoutes = [
    "/",
    "/about",
    "/contact",
    "/login",
    "/register",
    "/classes", // Add the classes route
    // Add other static public routes as needed
];

// You could potentially fetch dynamic routes (e.g., blog posts) here if needed
// const getDynamicRoutes = async () => {
//   // Fetch data...
//   return ["/blog/post-1", "/blog/post-2"];
// }

export async function loader({ request }: LoaderFunctionArgs) {
    // const dynamicRoutes = await getDynamicRoutes();
    // const allRoutes = [...staticRoutes, ...dynamicRoutes];
    const allRoutes = [...staticRoutes]; // Using only static for now

    const sitemap = `
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${allRoutes
        .map((route) =>
            `
        <url>
          <loc>${siteConfig.url}${route}</loc>
          <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
          <changefreq>weekly</changefreq> 
          <priority>${route === "/" ? "1.0" : "0.8"}</priority> 
        </url>
      `.trim()
        )
        .join("")}
    </urlset>
  `.trim();

    return new Response(sitemap, {
        status: 200,
        headers: {
            "Content-Type": "application/xml",
            "xml-stylesheet": 'type="text/xsl" href="/sitemap.xsl"', // Optional: Link to a stylesheet for browser viewing
        },
    });
}
