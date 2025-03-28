import { Outlet } from "@remix-run/react";
import Navbar from "~/components/Navbar";
import Footer from "~/components/Footer";

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen text-gray-900 dark:text-white">
      <Navbar />
      <main className="flex-grow pt-16 pb-16">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
