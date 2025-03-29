// Removed loader function entirely for debugging outlet rendering
// import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useRouteError } from "@remix-run/react"; // Removed useLoaderData
// import { getSupabaseServerClient } from "~/utils/supabase.server";


// Temporarily simplified for debugging
export default function AdminDashboard() {
  // Removed useLoaderData hook as loader is removed
  // const { familyCount, studentCount, totalPayments, attendanceToday } = useLoaderData<typeof loader>();

  return (
    // Add a bright background to ensure it's not just invisible
    <div className="bg-lime-300 p-5"> 
      <h1 className="text-4xl font-bold text-red-500 p-10">ADMIN DASHBOARD TEST</h1>
      {/* Original content commented out below for easy restoration */}
    </div>
    /*
    <div className="max-w-7xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-500">Total Families</h2>
          <p className="text-3xl font-bold">{familyCount}</p>
          <Link to="/admin/families" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
            View all families →
          </Link>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-500">Total Students</h2>
          <p className="text-3xl font-bold">{studentCount}</p>
          <Link to="/admin/students" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
            View all students →
          </Link>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-500">Total Payments</h2>
          <p className="text-3xl font-bold">${totalPayments.toFixed(2)}</p>
          <Link to="/admin/payments" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
            View payment history →
          </Link>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-500">Today&apos;s Attendance</h2>
          <p className="text-3xl font-bold">{attendanceToday}</p>
          <Link to="/admin/attendance" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
            Manage attendance →
          </Link>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link 
              to="/admin/families/new" 
              className="block p-3 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
            >
              Register New Family
            </Link>
            <Link 
              to="/admin/attendance/record" 
              className="block p-3 bg-green-50 text-green-700 rounded hover:bg-green-100"
            >
              Record Today&apos;s Attendance
            </Link>
            <Link 
              to="/admin/payments/new" 
              className="block p-3 bg-purple-50 text-purple-700 rounded hover:bg-purple-100"
            >
              Process New Payment
            </Link>
            <Link 
              to="/admin/achievements/award" 
              className="block p-3 bg-yellow-50 text-yellow-700 rounded hover:bg-yellow-100"
            >
              Award Achievement
            </Link>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">System Status</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">Upcoming Classes</h3>
              <p className="text-gray-600">
                Next class: Today at 6:00 PM
              </p>
            </div>
            
            <div>
              <h3 className="font-medium">Missing Waivers</h3>
              <p className="text-gray-600">
                3 students missing required waivers
              </p>
              <Link to="/admin/waivers/missing" className="text-blue-600 text-sm hover:underline">
                View details
              </Link>
            </div>
            
            <div>
              <h3 className="font-medium">Pending Payments</h3>
              <p className="text-gray-600">
                2 families with pending payments
              </p>
              <Link to="/admin/payments/pending" className="text-blue-600 text-sm hover:underline">
                View details
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
    */
  );
}

// Add a specific ErrorBoundary for this route
export function ErrorBoundary() {
  const error = useRouteError() as Error; // Basic error type
  console.error("Error caught in AdminDashboard ErrorBoundary:", error); // Log the specific error

  return (
    <div className="p-4 bg-pink-100 border border-pink-400 text-pink-700 rounded">
      <h2 className="text-xl font-bold mb-2">Error Loading Admin Dashboard Content</h2>
      <p>{error?.message || "An unknown error occurred within the dashboard component."}</p>
      {process.env.NODE_ENV === "development" && (
        <pre className="mt-4 p-2 bg-pink-50 text-pink-900 rounded-md max-w-full overflow-auto text-xs">
          {error?.stack || JSON.stringify(error, null, 2)}
        </pre>
      )}
    </div>
  );
}
