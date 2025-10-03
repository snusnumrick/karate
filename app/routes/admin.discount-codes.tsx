import { Outlet } from "@remix-run/react";
import { json } from "@remix-run/node";

// Pass-through loader - auth is handled by parent admin.tsx layout
export async function loader() {
  return json({});
}

export default function DiscountCodesLayout() {
  return <Outlet />;
}
