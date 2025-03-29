import { Outlet } from "@remix-run/react";
// Removed loader, ErrorBoundary, and other imports as this is now just a passthrough layout

// Minimal layout component - just renders the child route
export default function AdminPassthroughLayout() {
  console.log("Rendering AdminPassthroughLayout"); // Add log
  return <Outlet />;
}
