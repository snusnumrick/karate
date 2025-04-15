import { Outlet } from "@remix-run/react";

// This is a simple layout route for the /admin/store section
// It doesn't need its own loader as it inherits from /admin
export default function AdminStoreLayout() {
    return <Outlet />;
}
