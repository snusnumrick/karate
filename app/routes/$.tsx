import { Link } from "@remix-run/react";
import { Button } from "~/components/ui/button"; // Assuming Button component path

export default function SplatRoute() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center px-4">
        <img
            src="/logo-light.svg" // Or your preferred logo
            alt="Karate Greenegin Logo - Kids Martial Arts Victoria BC"
            className="h-20 w-87 mb-8 dark:hidden"
        />
        <img
            src="/logo-dark.svg" // Or your preferred logo
            alt="Karate Greenegin Logo - Kids Martial Arts Victoria BC, Dark Mode"
            className="h-20 w-87 mb-8 hidden dark:block"
        />
      <h1 className="text-4xl font-bold text-destructive mb-4">404 - Page Not Found</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Oops! The page you are looking for does not exist or may have been moved.
      </p>
      <Button asChild>
        <Link to="/">Return to Homepage</Link>
      </Button>
    </div>
  );
}

// Optional: Add meta tags for the 404 page
export function meta() {
    return [
        { title: "Page Not Found | Karate Greenegin" },
        { name: "description", content: "The requested page could not be found." },
    ];
}
