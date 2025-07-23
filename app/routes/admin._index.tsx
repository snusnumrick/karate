import { json, type LoaderFunctionArgs } from "@remix-run/node"; // Keep json, LoaderFunctionArgs
import { Link, useLoaderData } from "@remix-run/react"; // Remove useRouteError
// Remove getSupabaseServerClient import as it's no longer needed here
import { createClient } from '@supabase/supabase-js'; // Import createClient
import { PaymentStatus } from "~/types/models"; // Import the enum
import { getTodayLocalDateString } from "~/components/calendar/utils";
import { getInvoiceStats } from "~/services/invoice.server";
import { getInvoiceEntities } from "~/services/invoice-entity.server";


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

        // Fetch class system stats
        const [
            {count: activeProgramsCount, error: programsError},
            {count: activeClassesCount, error: classesError},
            {count: totalEnrollmentsCount, error: enrollmentsError},
            {data: classCapacityData, error: capacityError},
            {count: waitlistCount, error: waitlistError},
            {data: nextClassData, error: nextClassError}
        ] = await Promise.all([
            supabaseAdmin.from('programs').select('id', {count: 'exact', head: true}).eq('is_active', true),
            supabaseAdmin.from('classes').select('id', {count: 'exact', head: true}).eq('is_active', true),
            supabaseAdmin.from('enrollments').select('id', {count: 'exact', head: true}).in('status', ['active', 'trial']),
            supabaseAdmin.from('classes')
                .select('id, max_capacity')
                .eq('is_active', true),
            supabaseAdmin.from('enrollments').select('id', {count: 'exact', head: true}).eq('status', 'waitlist'),
            supabaseAdmin.from('class_sessions')
                .select(`
                    session_date,
                    start_time,
                    class:classes(name)
                `)
                .eq('status', 'scheduled')
                .gte('session_date', getTodayLocalDateString())
                .order('session_date', { ascending: true })
                .order('start_time', { ascending: true })
                .limit(1)
        ]);

        if (programsError) console.error("Error fetching programs count:", programsError.message);
        if (classesError) console.error("Error fetching classes count:", classesError.message);
        if (enrollmentsError) console.error("Error fetching enrollments count:", enrollmentsError.message);
        if (capacityError) console.error("Error fetching capacity data:", capacityError.message);
        if (waitlistError) console.error("Error fetching waitlist count:", waitlistError.message);
        if (nextClassError) console.error("Error fetching next class:", nextClassError.message);

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
            {error: usersSignaturesError}, // Fetch users who signed *any* required waiver
            {data: discountUsageData, error: discountUsageError}, // Fetch discount usage stats
            invoiceStats,
            invoiceEntitiesResult
        ] = await Promise.all([
            supabaseAdmin.from('families').select('id', {count: 'exact', head: true}), // Use admin client
            supabaseAdmin.from('students').select('id', {count: 'exact', head: true}), // Use admin client
            supabaseAdmin.from('payments').select('total_amount').eq('status', PaymentStatus.Succeeded), // Use total_amount
            supabaseAdmin.from('attendance')
                .select('id', {count: 'exact', head: true})
                .eq('class_date', getTodayLocalDateString()) // Today's date
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
                .gte('used_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
            // Fetch invoice statistics
            getInvoiceStats(supabaseAdmin),
            getInvoiceEntities({}, 1, 1000, supabaseAdmin)
        ]);

        // Extract invoice entities from the result
        const invoiceEntities = invoiceEntitiesResult?.entities || [];

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

        // Calculate total enrollment from actual enrollment count
        const totalEnrolled = totalEnrollmentsCount || 0;

        // Format next class data
        let nextClassInfo = "No upcoming classes";
        if (nextClassData && nextClassData.length > 0) {
            const nextClass = nextClassData[0];
            // Parse date string as local date to avoid timezone issues
            const [year, month, day] = nextClass.session_date.split('-').map(Number);
            const sessionDate = new Date(year, month - 1, day);
            const today = new Date();
            const isToday = sessionDate.toDateString() === today.toDateString();
            const timeStr = nextClass.start_time;
            const dateStr = isToday ? "Today" : sessionDate.toLocaleDateString();
            nextClassInfo = `${(nextClass.class as { name?: string })?.name || 'Class'} - ${dateStr} at ${timeStr}`;
        }

        // Count families missing waivers instead of individual users
        // Use the already declared requiredWaiverIds from above
        
        // Get all profiles grouped by family
        const { data: familyProfiles, error: familyProfilesError } = await supabaseAdmin
            .from('profiles')
            .select('id, family_id')
            .eq('role', 'user')
            .not('family_id', 'is', null); // Only include profiles with a family
            
        if (familyProfilesError) {
            console.error("Error fetching family profiles:", familyProfilesError.message);
        }
        
        // Group profiles by family
        const familyMap = new Map<string, string[]>(); // Map<family_id, user_ids[]>
        if (familyProfiles) {
            familyProfiles.forEach(profile => {
                if (!profile.family_id) return;
                
                if (!familyMap.has(profile.family_id)) {
                    familyMap.set(profile.family_id, []);
                }
                familyMap.get(profile.family_id)!.push(profile.id);
            });
        }
        
        // Get all waiver signatures for required waivers
        const { data: allSignatures, error: allSignaturesError } = await supabaseAdmin
            .from('waiver_signatures')
            .select('user_id, waiver_id')
            .in('waiver_id', requiredWaiverIds);
            
        if (allSignaturesError) {
            console.error("Error fetching all signatures:", allSignaturesError.message);
        }
        
        // Create a map of user_id -> Set of signed waiver_ids
        const userSignaturesMap = new Map<string, Set<string>>();
        if (allSignatures) {
            allSignatures.forEach(sig => {
                if (!userSignaturesMap.has(sig.user_id)) {
                    userSignaturesMap.set(sig.user_id, new Set());
                }
                userSignaturesMap.get(sig.user_id)!.add(sig.waiver_id);
            });
        }
        
        // Count families missing any required waivers
        let familiesMissingWaivers = 0;
        
        familyMap.forEach((userIds) => {
            // Check if any user in the family is missing any required waiver
            const isFamilyMissingWaivers = userIds.some(userId => {
                const signedWaivers = userSignaturesMap.get(userId) || new Set();
                // If this user hasn't signed all required waivers, the family is missing waivers
                return requiredWaiverIds.some(waiverId => !signedWaivers.has(waiverId));
            });
            
            if (isFamilyMissingWaivers) {
                familiesMissingWaivers++;
            }
        });
        
        const missingWaiversCount = familiesMissingWaivers;

        // Fetch today's sessions
        // Get today's date in local timezone to avoid timezone issues
        const today = getTodayLocalDateString();
        const { data: todaysSessions, error: sessionsError } = await supabaseAdmin
            .from('class_sessions')
            .select(`
                id,
                session_date,
                start_time,
                end_time,
                status,
                class_id,
                classes!inner(
                    id,
                    name,
                    programs!inner(name)
                )
            `)
            .eq('session_date', today)
            .order('start_time');

        if (sessionsError) {
            console.error("Error fetching today's sessions:", sessionsError.message);
        }

        // Calculate session statistics using local date parsing
        const totalTodaysSessions = todaysSessions?.length || 0;
        const completedSessions = todaysSessions?.filter((s: { status: string }) => s.status === 'completed').length || 0;
        const inProgressSessions = todaysSessions?.filter((s: { status: string; session_date: string; start_time: string; end_time: string }) => {
            if (s.status !== 'scheduled') return false;
            const now = new Date();
            // Parse session date as local date to avoid timezone issues
            const [year, month, day] = s.session_date.split('-').map(Number);
            const sessionDate = new Date(year, month - 1, day);
            const [startHour, startMin] = s.start_time.split(':').map(Number);
            const [endHour, endMin] = s.end_time.split(':').map(Number);
            const sessionStart = new Date(sessionDate);
            sessionStart.setHours(startHour, startMin, 0, 0);
            const sessionEnd = new Date(sessionDate);
            sessionEnd.setHours(endHour, endMin, 0, 0);
            return now >= sessionStart && now <= sessionEnd;
        }).length || 0;
        const upcomingSessions = todaysSessions?.filter((s: { status: string; session_date: string; start_time: string }) => {
            if (s.status !== 'scheduled') return false;
            const now = new Date();
            // Parse session date as local date to avoid timezone issues
            const [year, month, day] = s.session_date.split('-').map(Number);
            const sessionDate = new Date(year, month - 1, day);
            const [startHour, startMin] = s.start_time.split(':').map(Number);
            const sessionStart = new Date(sessionDate);
            sessionStart.setHours(startHour, startMin, 0, 0);
            return now < sessionStart;
        }).length || 0;

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
            // New class system stats
            activeProgramsCount: activeProgramsCount ?? 0,
            activeClassesCount: activeClassesCount ?? 0,
            totalEnrollmentsCount: totalEnrollmentsCount ?? 0,
            totalEnrolled: totalEnrolled,
            totalCapacity: classCapacityData?.reduce((sum, classData) => sum + (classData.max_capacity || 0), 0) || 0,
            waitlistCount: waitlistCount ?? 0,
            nextClassInfo: nextClassInfo,
            // Today's sessions data
            totalTodaysSessions,
            completedSessions,
            inProgressSessions,
            upcomingSessions,
            todaysSessions: todaysSessions || [],
            // Invoice statistics
            invoiceStats: invoiceStats || {
                total_invoices: 0,
                total_amount: 0,
                paid_amount: 0,
                outstanding_amount: 0,
                overdue_count: 0,
            },
            totalInvoiceEntities: invoiceEntities.length || 0,
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
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

                {/* Active Programs Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-green-600">
                    <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400">Active Programs</h2>
                    <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{data.activeProgramsCount}</p>
                    <Link to="/admin/programs"
                          className="text-green-600 dark:text-green-400 text-sm hover:underline mt-2 inline-block">
                        Manage programs →
                    </Link>
                </div>

                {/* Active Classes Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-green-600">
                    <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400">Active Classes</h2>
                    <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{data.activeClassesCount}</p>
                    <Link to="/admin/classes"
                          className="text-green-600 dark:text-green-400 text-sm hover:underline mt-2 inline-block">
                        Manage classes →
                    </Link>
                </div>

                {/* Total Enrollments Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-green-600">
                    <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400">Total Enrollments</h2>
                    <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{data.totalEnrollmentsCount}</p>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {data.waitlistCount} on waitlist
                    </div>
                    <Link to="/admin/enrollments"
                          className="text-green-600 dark:text-green-400 text-sm hover:underline mt-2 inline-block">
                        Manage enrollments →
                    </Link>
                </div>

                {/* Capacity Utilization Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-blue-600">
                    <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400">Capacity Utilization</h2>
                    <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                        {data.totalCapacity > 0 ? Math.round((data.totalEnrolled / data.totalCapacity) * 100) : 0}%
                    </p>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {data.totalEnrolled} / {data.totalCapacity} spots filled
                    </div>
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

                {/* Invoice Entities Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-purple-600">
                    <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400">Invoice Entities</h2>
                    <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{data.totalInvoiceEntities}</p>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Billing entities configured
                    </div>
                    <Link to="/admin/invoice-entities"
                          className="text-purple-600 dark:text-purple-400 text-sm hover:underline mt-2 inline-block">
                        Manage entities →
                    </Link>
                </div>

                {/* Total Invoices Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-blue-600">
                    <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400">Total Invoices</h2>
                    <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">{data.invoiceStats.total_invoices}</p>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        ${(data.invoiceStats.total_amount / 100).toFixed(2)} total value
                    </div>
                    <Link to="/admin/invoices"
                          className="text-blue-600 dark:text-blue-400 text-sm hover:underline mt-2 inline-block">
                        View all invoices →
                    </Link>
                </div>

                {/* Outstanding Invoices Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-l-4 border-orange-600">
                    <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400">Outstanding Amount</h2>
                    <p className="text-3xl font-bold text-gray-800 dark:text-gray-100">${(data.invoiceStats.outstanding_amount / 100).toFixed(2)}</p>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {data.invoiceStats.overdue_count} overdue invoices
                    </div>
                    <Link to="/admin/invoices?status=sent,overdue"
                          className="text-orange-600 dark:text-orange-400 text-sm hover:underline mt-2 inline-block">
                        View outstanding →
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
                            to="/admin/programs/new"
                            className="block p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                        >
                            Create New Program
                        </Link>
                        <Link
                            to="/admin/classes/new"
                            className="block p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                        >
                            Create New Class
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
                        <Link
                            to="/admin/discount-codes/new"
                            className="block p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                        >
                            Create Discount Code
                        </Link>
                        <Link
                            to="/admin/invoice-entities/new"
                            className="block p-3 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                        >
                            Create Invoice Entity
                        </Link>
                        <Link
                            to="/admin/invoices/new"
                            className="block p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                        >
                            Create Invoice
                        </Link>
                    </div>
                </div>

                {/* System Status Card */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">System Status</h2>
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-medium text-gray-700 dark:text-gray-300">Today&apos;s Attendance</h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                {data.attendanceToday} students attended today
                            </p>
                            <Link to="/admin/attendance"
                                  className="text-green-600 dark:text-green-400 text-sm hover:underline">
                                Manage attendance →
                            </Link>
                        </div>

                        <div>
                            <h3 className="font-medium text-gray-700 dark:text-gray-300">Upcoming Classes</h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                Next class: {data.nextClassInfo}
                            </p>
                            <Link to="/admin/classes"
                                  className="text-green-600 dark:text-green-400 text-sm hover:underline">
                                View all classes →
                            </Link>
                        </div>

                        <div>
                            <h3 className="font-medium text-gray-700 dark:text-gray-300">Missing Waivers</h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                {data.missingWaiversCount} families missing required waivers
                            </p>
                            <Link to="/admin/waivers/missing"
                                  className="text-green-600 dark:text-green-400 text-sm hover:underline">
                                View details →
                            </Link>
                        </div>

                        <div>
                            <h3 className="font-medium text-gray-700 dark:text-gray-300">Pending Payments</h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                {data.pendingPaymentsCount} families with pending payments
                            </p>
                            <Link to="/admin/payments/pending"
                                  className="text-green-600 dark:text-green-400 text-sm hover:underline">
                                View details →
                            </Link>
                        </div>

                        <div>
                            <h3 className="font-medium text-gray-700 dark:text-gray-300">Invoice Status</h3>
                            <p className="text-gray-600 dark:text-gray-400">
                                ${(data.invoiceStats.paid_amount / 100).toFixed(2)} collected, ${(data.invoiceStats.outstanding_amount / 100).toFixed(2)} outstanding
                            </p>
                            <Link to="/admin/invoices"
                                  className="text-green-600 dark:text-green-400 text-sm hover:underline">
                                Manage invoices →
                            </Link>
                        </div>

                        <div>
                            <h3 className="font-medium text-gray-700 dark:text-gray-300">Today&apos;s Sessions</h3>
                            <div className="space-y-2">
                                {data.todaysSessions.length > 0 ? (
                                    data.todaysSessions.slice(0, 3).map((session) => (
                                        <div key={session.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded">
                                            <div>
                                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                    {(session.classes as { name?: string })?.name}
                                </p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                                    {session.start_time} - {session.end_time}
                                                </p>
                                            </div>
                                            <div className="flex space-x-2">
                                                <Link
                                                    to={`/admin/attendance/record?session=${session.id}`}
                                                    className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
                                                >
                                                    Attendance
                                                </Link>
                                                {session.status === 'scheduled' && (
                                                    <>
                                                        <Link
                                            to={`/admin/classes/${(session.classes as { id?: string })?.id}/sessions/${session.id}/complete`}
                                            className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded hover:bg-green-200 dark:hover:bg-green-800"
                                        >
                                            Complete
                                        </Link>
                                        <Link
                                            to={`/admin/classes/${(session.classes as { id?: string })?.id}/sessions/${session.id}/cancel`}
                                            className="text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-2 py-1 rounded hover:bg-red-200 dark:hover:bg-red-800"
                                        >
                                            Cancel
                                        </Link>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                                        No sessions scheduled for today
                                    </p>
                                )}
                                {data.todaysSessions.length > 3 && (
                                    <Link to="/admin/sessions/today"
                                          className="text-blue-600 dark:text-blue-400 text-sm hover:underline block">
                                        View all {data.todaysSessions.length} sessions →
                                    </Link>
                                )}
                            </div>
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
