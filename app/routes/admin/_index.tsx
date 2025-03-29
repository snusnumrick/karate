import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { getSupabaseServerClient, isUserAdmin } from "~/utils/supabase.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { supabaseServer } = getSupabaseServerClient(request);
  
  // Get the current user
  const { data: { user } } = await supabaseServer.auth.getUser();
  
  if (!user) {
    return redirect('/login?redirectTo=/admin');
  }
  
  // Check if user is admin
  const isAdmin = await isUserAdmin(user.id);
  
  if (!isAdmin) {
    return redirect('/');
  }
  
  // Get summary data for dashboard
  const [
    { data: families },
    { data: students },
    { data: payments },
    { data: attendanceToday }
  ] = await Promise.all([
    supabaseServer.from('families').select('id').limit(1000),
    supabaseServer.from('students').select('id').limit(1000),
    supabaseServer.from('payments').select('amount').limit(1000),
    supabaseServer.from('attendance')
      .select('*')
      .eq('class_date', new Date().toISOString().split('T')[0])
  ]);
  
  return json({
    familyCount: families?.length || 0,
    studentCount: students?.length || 0,
    totalPayments: payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0,
    attendanceToday: attendanceToday?.length || 0
  });
}

// Temporarily simplified for debugging
export default function AdminDashboard() {
  // const { familyCount, studentCount, totalPayments, attendanceToday } = useLoaderData<typeof loader>();

  return (
    <div>
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
