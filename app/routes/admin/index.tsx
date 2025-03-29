import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Link, useRouteError, useLoaderData } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";

// Loader now only fetches data, assumes auth handled by parent layout (admin.tsx)
export async function loader({ request }: LoaderFunctionArgs) {
  console.log("Entering /admin/index loader (data fetch only)..."); // Updated log
  const { supabaseServer, response } = getSupabaseServerClient(request);
  const headers = response.headers;

  // --- Data fetching logic ---
  try {
    console.log("Admin index loader - Fetching dashboard data..."); // Add log
    const [
      { count: familyCount, error: familiesError },
      { count: studentCount, error: studentsError },
      { data: payments, error: paymentsError }, // Fetch amounts to sum
      { count: attendanceToday, error: attendanceError }
    ] = await Promise.all([
      supabaseServer.from('families').select('id', { count: 'exact', head: true }),
      supabaseServer.from('students').select('id', { count: 'exact', head: true }),
      supabaseServer.from('payments').select('amount').eq('status', 'completed'), // Only count completed payments
      supabaseServer.from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('class_date', new Date().toISOString().split('T')[0])
        .eq('present', true) // Only count present students
    ]);

    if (familiesError) console.error("Error fetching families count:", familiesError.message);
    if (studentsError) console.error("Error fetching students count:", studentsError.message);
    if (paymentsError) console.error("Error fetching payments:", paymentsError.message);
    if (attendanceError) console.error("Error fetching attendance count:", attendanceError.message);

    const totalPaymentAmount = payments?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;

    console.log("Admin index loader - Data fetched."); // Add log

    return json({
      familyCount: familyCount ?? 0,
      studentCount: studentCount ?? 0,
      totalPayments: totalPaymentAmount,
      attendanceToday: attendanceToday ?? 0
    }, { headers });

  } catch (error: any) {
    console.error("Error in /admin/index loader data fetch:", error.message);
    // Let the error boundary in the layout handle this
    // Preserve headers in error response
    console.error("Data fetch error - throwing 500 with headers");
    throw new Response("Failed to load dashboard data.", { 
      status: 500,
      headers: Object.fromEntries(headers)
    });
  }
  // --- End of data fetching ---
}


// Temporarily simplified for debugging
export default function AdminDashboard() {
  // Re-add useLoaderData
  const data = useLoaderData<typeof loader>();
  console.log("Rendering AdminDashboard component, loader data:", data); // Add log

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="bg-red-500 p-4 text-white rounded-lg mb-8">
        <p>Temporary debug view - Dashboard content visible</p>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-500">Total Families</h2>
          <p className="text-3xl font-bold">{data.familyCount}</p>
          <Link to="/admin/families" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
            View all families →
          </Link>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-500">Total Students</h2>
          <p className="text-3xl font-bold">{data.studentCount}</p>
          <Link to="/admin/students" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
            View all students →
          </Link>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-500">Total Payments</h2>
          <p className="text-3xl font-bold">${data.totalPayments.toFixed(2)}</p>
          <Link to="/admin/payments" className="text-blue-600 text-sm hover:underline mt-2 inline-block">
            View payment history →
          </Link>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-medium text-gray-500">Today&apos;s Attendance</h2>
          <p className="text-3xl font-bold">{data.attendanceToday}</p>
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
