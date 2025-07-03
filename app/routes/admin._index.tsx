import { json, type LoaderFunctionArgs } from "@remix-run/node"; // Keep json, LoaderFunctionArgs
import { Link, useLoaderData } from "@remix-run/react"; // Remove useRouteError
// Remove getSupabaseServerClient import as it's no longer needed here
import { createClient } from '@supabase/supabase-js'; // Import createClient
import { PaymentStatus } from "~/types/models"; // Import the enum

// Loader now only fetches data, assumes auth handled by parent layout (_admin.tsx)
// Give the unused argument object a name prefixed with underscore and disable the lint rule for this line
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function loader(_: LoaderFunctionArgs) {
    console.log("Entering /admin/index loader (data fetch only)...");

    // Create a service role client directly for admin-level data fetching
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Admin index loader: Missing Supabase URL or Service Role Key env variables.");
        // Throw simple response, headers are handled by parent/Remix
        throw new Response("Server configuration error.", { status: 500 });
    }

    // Use service role client for admin data access
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // --- Data fetching logic using supabaseAdmin ---
    try {
        console.log("Admin index loader - Fetching dashboard data using service role..."); // Add log

        // --- Data fetching logic ---
        // Fetch required waiver IDs first (using admin client)
        const {data: requiredWaivers, error: requiredWaiversError} = await supabaseAdmin
            .from('waivers')
            .select('id')
            .eq('required', true);

        if (requiredWaiversError) {
            console.error("Error fetching required waivers:", requiredWaiversError.message);
            // Throw simple response
            throw new Response("Failed to load required waiver data.", { status: 500 });
        }
        const requiredWaiverIds = requiredWaivers?.map(w => w.id) || [];

        // Fetch discount codes stats
        const {count: activeDiscountCodes, error: discountCodesError} = await supabaseAdmin
            .from('discount_codes')
            .select('id', {count: 'exact', head: true})
            .eq('is_active', true);

        if (discountCodesError) {
            console.error("Error fetching discount codes count:", discountCodesError.message);
        }

        // Now fetch dashboard stats in parallel
        const [
            {count: familyCount, error: familiesError},
            {count: studentCount, error: studentsError},
            {data: completedPayments, error: paymentsError}, // Fetch amounts to sum
            {count: attendanceToday, error: attendanceError},
            {data: pendingPaymentsFamilies, error: pendingPaymentsError},
            // Fetch users who haven't signed *all* required waivers
            // This is a bit complex, might need a dedicated function/view later
            // Simplified approach: Count users missing *at least one* required waiver
            {data: usersWithAnySignature, error: usersSignaturesError}, // Fetch users who signed *any* required waiver
            {data: discountUsageData, error: discountUsageError} // Fetch discount usage stats
        ] = await Promise.all([
            supabaseAdmin.from('families').select('id', {count: 'exact', head: true}), // Use admin client
            supabaseAdmin.from('students').select('id', {count: 'exact', head: true}), // Use admin client
            supabaseAdmin.from('payments').select('total_amount').eq('status', PaymentStatus.Succeeded), // Use total_amount
            supabaseAdmin.from('attendance')
                .select('id', {count: 'exact', head: true})
                .eq('class_date', new Date().toISOString().split('T')[0]) // Today's date
                .eq('present', true), // Use admin client
            supabaseAdmin.from('payments')
                .select('family_id')
                .eq('status', PaymentStatus.Pending), // Use enum
            // Fetch distinct user_ids who have signed *at least one* required waiver
            supabaseAdmin.from('waiver_signatures')
                .select('user_id', {count: 'exact', head: true}) // Count distinct users
                .in('waiver_id', requiredWaiverIds), // Use admin client
            // Fetch discount usage stats for this month
            supabaseAdmin.from('discount_code_usage')
                .select('discount_amount')
                .gte('used_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
        ]);

        // --- Error Handling ---
        // Combine error checks for brevity
        const errors = [
            {name: "families count", error: familiesError},
            {name: "students count", error: studentsError},
            {name: "completed payments", error: paymentsError},
            {name: "attendance count", error: attendanceError},
            {name: "pending payments data", error: pendingPaymentsError},
            {name: "user signatures count", error: usersSignaturesError},
            {name: "discount usage data", error: discountUsageError}
        ];
        errors.forEach(({name, error}) => {
            if (error) console.error(`Error fetching ${name}:`, error.message);
        });
        // Note: A more robust missing waiver count might need a dedicated function/view later.
        // This simplified version counts families with pending payments and users who have signed *any* required waiver.
        // We'll use the pending payment count directly. Missing waivers needs refinement.

        // --- Data Processing ---
        // Use total_amount from the fetched payments
        const totalPaymentAmount = completedPayments?.reduce((sum, payment) => sum + (payment.total_amount || 0), 0) || 0;

        // Count distinct families with pending payments
        const uniqueFamilyIds = new Set(pendingPaymentsFamilies?.map(p => p.family_id) || []);
        const pendingPaymentsCount = uniqueFamilyIds.size;

        // Calculate discount usage stats
        const totalDiscountAmount = discountUsageData?.reduce((sum, usage) => sum + (usage.discount_amount || 0), 0) || 0;
        const discountUsageCount = discountUsageData?.length || 0;

        // Placeholder for missing waivers count - needs refinement
        // Fetch total active users vs signed users (using admin client)
        const {count: totalUserCount, error: totalUserError} = await supabaseAdmin
            .from('profiles')
            .select('id', {count: 'exact', head: true})
            .eq('role', 'user'); // Assuming 'user' role means active family member

        if (totalUserError) console.error("Error fetching total user count:", totalUserError.message);

        // This is still an approximation. A user might have signed one required waiver but not another.
        // A proper count needs to check if *each* user has signed *all* required waivers.
        // Let's use a placeholder value for now until a more complex query/function is built.
        // Use the count directly from the query for usersWithAnySignature
        const signedUserCount = usersWithAnySignature?.length ?? 0;
        const missingWaiversCount = totalUserCount ? totalUserCount - signedUserCount : 0; // Highly approximate

        console.log("Admin index loader - Data fetched.");

        // Return data without explicitly setting headers
        return json({
            familyCount: familyCount ?? 0,
            studentCount: studentCount ?? 0,
            totalPayments: totalPaymentAmount,
            attendanceToday: attendanceToday ?? 0,
            pendingPaymentsCount: pendingPaymentsCount ?? 0,
            missingWaiversCount: missingWaiversCount < 0 ? 0 : missingWaiversCount, // Ensure non-negative
            activeDiscountCodes: activeDiscountCodes ?? 0,
            totalDiscountAmount: totalDiscountAmount,
            discountUsageCount: discountUsageCount,
        }); // Remove headers object

    } catch (error) {
        if (error instanceof Error) {
            console.error("Error in /admin/index loader data fetch:", error.message);
        } else {
            console.error("Error in /admin/index loader data fetch:", error);
        }
        // Let the error boundary in the layout handle this
        // Throw simple response
        console.error("Data fetch error - throwing 500");
        throw new Response("Failed to load dashboard data.", { status: 500 });
    }
}


// Temporarily simplified for debugging
export default function AdminDashboard() {
    // Re-add useLoaderData
    const data = useLoaderData<typeof loader>();
    console.log("Rendering AdminDashboard component, loader data:", data);

    return (
        <div className="max-w-7xl mx-auto py-8 px-4">
            {/* Remove the temporary debug view */}
            {/* <div className="bg-red-500 p-4 text-white rounded-lg mb-8"> ... </div> */}

            <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-gray-100">Admin Dashboard</h1>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
                {/* Total Families Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-green-600">
                    <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400">Total Families</h2>
                    <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{data.familyCount}</p>
                    <Link to="/admin/families"
                          className="text-green-600 dark:text-green-400 text-sm hover:underline mt-2 inline-block">
                        View all families →
                    </Link>
                </div>

                {/* Total Students Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-green-600">
                    <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400">Total Students</h2>
                    <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{data.studentCount}</p>
                    <Link to="/admin/students"
                          className="text-green-600 dark:text-green-400 text-sm hover:underline mt-2 inline-block">
                        View all students →
                    </Link>
                </div>

                {/* Total Payments Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-green-600">
                    <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400">Total Payments (Completed)</h2>
                    {/* Divide by 100 to convert cents to dollars */}
                    <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">${(data.totalPayments / 100).toFixed(2)}</p>
                    <Link to="/admin/payments"
                          className="text-green-600 dark:text-green-400 text-sm hover:underline mt-2 inline-block">
                        View payment history →
                    </Link>
                </div>

                {/* Today's Attendance Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-green-600">
                    <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400">Today&apos;s Attendance</h2>
                    <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{data.attendanceToday}</p>
                    <Link to="/admin/attendance"
                          className="text-green-600 dark:text-green-400 text-sm hover:underline mt-2 inline-block">
                        Manage attendance →
                    </Link>
                </div>

                {/* Active Discount Codes Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-green-600">
                    <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400">Active Discount Codes</h2>
                    <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{data.activeDiscountCodes}</p>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        ${(data.totalDiscountAmount / 100).toFixed(2)} saved this month
                    </div>
                    <Link to="/admin/discount-codes"
                          className="text-green-600 dark:text-green-400 text-sm hover:underline mt-2 inline-block">
                        Manage discount codes →
                    </Link>
                </div>
            </div>

            {/* Quick Actions & System Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Quick Actions Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Quick Actions</h2>
                    <div className="space-y-3">
                        <Link
                            to="/admin/families/new"
                            className="block p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                        >
                            Register New Family
                        </Link>
                        <Link
                            to="/admin/attendance/record"
                            className="block p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                        >
                            Record Today&apos;s Attendance
                        </Link>
                        <Link
                            to="/admin/payments/new"
                            className="block p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                        >
                            Process New Payment
                        </Link>
                        {/* Update link to point to the student list */}
                        <Link
                            to="/admin/students"
                            className="block p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                        >
                            Manage Students
                        </Link>
                        <Link
                            to="/admin/discount-codes/new"
                            className="block p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                        >
                            Create Discount Code
                        </Link>
                    </div>
                </div>

                {/* System Status Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">System Status</h2>
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-medium text-gray-700 dark:text-gray-300">Upcoming Classes</h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                Next class: Today at 6:00 PM {/* This could be dynamic later */}
                            </p>
                        </div>

                        <div>
                            <h3 className="font-medium text-gray-700 dark:text-gray-300">Missing Waivers</h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                {data.missingWaiversCount} users missing required waivers {/* Using fetched data */}
                            </p>
                            <Link to="/admin/waivers/missing"
                                  className="text-green-600 dark:text-green-400 text-sm hover:underline">
                                View details
                            </Link>
                        </div>

                        <div>
                            <h3 className="font-medium text-gray-700 dark:text-gray-300">Pending Payments</h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                {data.pendingPaymentsCount} families with pending payments {/* Using fetched data */}
                            </p>
                            <Link to="/admin/payments/pending"
                                  className="text-green-600 dark:text-green-400 text-sm hover:underline">
                                View details
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Removed the specific ErrorBoundary from this route.
// Errors will now bubble up to the layout's ErrorBoundary (_admin.tsx),
// ensuring the AdminNavbar and AdminFooter remain visible.
