import {json, type LoaderFunctionArgs, redirect, TypedResponse} from "@remix-run/node"; // Import redirect
import {Link, useLoaderData} from "@remix-run/react";
import {checkStudentEligibility, type EligibilityStatus, getSupabaseServerClient} from "~/utils/supabase.server"; // Import eligibility check
import { AlertCircle } from 'lucide-react'; // Import an icon for the alert
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"; // Import Alert components
import {Button} from "~/components/ui/button";
import {Badge} from "~/components/ui/badge"; // Import Badge
import {Database} from "~/types/supabase";
import {format} from 'date-fns'; // For formatting dates

// Define Guardian type
type GuardianRow = Database["public"]["Tables"]["guardians"]["Row"];

// Extend student type within FamilyData to include eligibility
type StudentWithEligibility = Database["public"]["Tables"]["students"]["Row"] & {
    eligibility: EligibilityStatus;
};

// Define FamilyData using the extended student type
export type FamilyData = Database["public"]["Tables"]["families"]["Row"] & {
    students?: StudentWithEligibility[]; // Use the extended student type
    payments?: (
        Database["public"]["Tables"]["payments"]["Row"] & {
        payment_students: {
            student_id: string;
        }[];
    }
        )[];
    guardians?: GuardianRow[]; // Add guardians array
};

interface LoaderData {
    profile?: { familyId: string };
    family?: FamilyData;
    individualSessionBalance?: number; // Renamed balance field
    error?: string;
    allWaiversSigned?: boolean;
}

// Placeholder loader - will need to fetch actual family data later
export async function loader({request}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        // This shouldn't happen if the route is protected by the layout,
        // but good practice to handle it.
        // Consider redirecting to login if needed, depending on layout setup.
        return json({error: "User not authenticated"}, {status: 401, headers});
    }

    // 1. Get the user's profile to find their family_id
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id') // Only fetch family_id, as names are not on this table
        .eq('id', user.id)
        .single();

    if (profileError || !profileData) {
        console.error("Error fetching profile:", profileError?.message);
        // If profile doesn't exist, maybe redirect to a setup page or show an error
        return json({
            error: "Failed to load user profile.",
        }, {status: 500, headers});
    }

    if (!profileData.family_id) {
        // User is logged in but not associated with a family yet. Redirect to setup.
        // This might happen after registration but before family creation/linking
        console.log("User authenticated but no family_id found. Redirecting to /family/setup");
        // Note: Ensure the /family/setup route exists or adjust the target URL.
        return redirect("/family/setup", {headers});
    }

    // 2. Fetch the family data *and* its related students and guardians (without payments initially)
    const {data: familyBaseData, error: familyError} = await supabaseServer
        .from('families')
        .select(`
          *,
          students(*),
          guardians(*)
        `)
        .eq('id', profileData.family_id)
        .single(); // Fetch the single family record

    if (familyError || !familyBaseData) { // Check if familyBaseData itself is null/undefined
        console.error("Error fetching base family data:", familyError?.message ?? "Family not found");
        return json({
            profile: {familyId: String(profileData.family_id)},
            error: "Failed to load family data.",
            allWaiversSigned: false
        }, {status: 500, headers});
    }

    // 3. Fetch the single most recent *successful* payment separately
    const { data: recentPaymentData, error: paymentError } = await supabaseServer
        .from('payments')
        .select(`
            *,
            payment_students(student_id)
        `)
        .eq('family_id', profileData.family_id) // Filter by family_id
        .eq('status', 'succeeded')             // Filter by status
        .order('payment_date', { ascending: false, nullsFirst: false }) // Order by date
        .order('created_at', { ascending: false }) // Then by time
        .limit(1)                              // Limit to one
        .maybeSingle(); // Use maybeSingle as there might be no successful payments

    if (paymentError) {
        console.error("Error fetching recent payment data:", paymentError.message);
        // Don't fail the whole page, just proceed without payment info
    }

    // Log the fetched recent payment
    console.log("Most Recent Successful Payment Data:", recentPaymentData);


    // 4. Fetch eligibility for each student IN the fetched family data
    const studentsWithEligibility: StudentWithEligibility[] = [];
    if (familyBaseData.students && familyBaseData.students.length > 0) {
        for (const student of familyBaseData.students) {
            const eligibility = await checkStudentEligibility(student.id, supabaseServer); // Use supabaseServer (service role)
            studentsWithEligibility.push({
                ...student,
                eligibility: eligibility,
            });
        }
    }

    // Combine base family data, students with eligibility, and the single payment (if found)
    const finalFamilyData: FamilyData = {
        ...familyBaseData,
        students: studentsWithEligibility,
        payments: recentPaymentData ? [recentPaymentData] : [], // Add payment as an array (or empty array)
    };


    // 5. Fetch required waivers and user's signatures to determine status
    let allWaiversSigned = false;
    let individualSessionBalance = 0; // Declare balance variable outside the try block

    try {
        const {data: requiredWaivers, error: requiredWaiversError} = await supabaseServer
            .from('waivers')
            .select('id')
            .eq('required', true);

        if (requiredWaiversError) throw requiredWaiversError;

        // If there are no required waivers, consider them "signed"
        if (!requiredWaivers || requiredWaivers.length === 0) {
            allWaiversSigned = true;
        }
        else {
            const {data: signedWaivers, error: signedWaiversError} = await supabaseServer
                .from('waiver_signatures')
                .select('waiver_id')
                .eq('user_id', user.id);

            if (signedWaiversError) throw signedWaiversError;

            const requiredWaiverIds = new Set(requiredWaivers.map(w => w.id));
            const signedWaiverIds = new Set(signedWaivers.map(s => s.waiver_id));

            // Check if every required waiver ID is present in the signed waiver IDs
            allWaiversSigned = [...requiredWaiverIds].every(id => signedWaiverIds.has(id));
        }

        // 5. Fetch individual session balance using the view
        // Remove inner try...catch, outer catch will handle errors
        const { data: balanceData, error: balanceError } = await supabaseServer
            .from('family_one_on_one_balance') // View name remains the same
            .select('total_remaining_sessions')
                .eq('family_id', profileData.family_id)
                .maybeSingle(); // Use maybeSingle as a family might not have any sessions yet

            if (balanceError) {
                console.error("[Family Loader] Error fetching Individual Session balance:", balanceError.message);
                // Don't fail the whole page load, just default to 0
            } else if (balanceData) {
                individualSessionBalance = balanceData.total_remaining_sessions ?? 0;
                // console.log(`[Family Loader] Fetched individualSessionBalance: ${individualSessionBalance}`); // Removed log
            } else {
                 // console.log(`[Family Loader] No balance data found for family ${profileData.family_id}, setting balance to 0.`); // Removed log
                 individualSessionBalance = 0; // Explicitly set to 0 if no data found
            }
    } catch (error: unknown) { // Outer catch handles errors from waiver or balance fetching
        if (error instanceof Error) {
            console.error("Error checking waiver status or balance:", error.message);
        } else {
            console.error("Error checking waiver status or balance:", error);
        }
        // Default waiver status and balance if there's an error
        allWaiversSigned = false;
        individualSessionBalance = 0; // Ensure balance is reset if outer catch is hit
    }

    // console.log('Family data with eligibility:', familyDataWithEligibility);

    // Return profile, combined family data, and waiver status
    return json({
        profile: {familyId: String(profileData.family_id)},
        family: finalFamilyData, // Use the combined data
        individualSessionBalance, // Include the renamed balance in the response
        allWaiversSigned
    }, {headers});
}


// Helper function for eligibility badge variants
const getEligibilityBadgeVariant = (status: EligibilityStatus['reason']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
        // Adjusted cases based on the actual reasons in EligibilityStatus
        case 'Paid - Monthly':
        case 'Paid - Yearly':
            return 'default'; // Greenish
        case 'Trial':
            return 'secondary'; // Bluish/Grayish
        case 'Expired':
            return 'destructive'; // Reddish
        default:
            return 'outline';
    }
};

export default function FamilyPortal() {
    // Now loader returns profile, family data, waiver status, and individual session balance
    const {family, individualSessionBalance, error, allWaiversSigned} = useLoaderData<typeof loader>();

    // Handle specific error messages from the loader
    if (error) {
        // Special handling if no family is associated yet
        if (error === "No family associated with this account.") {
            return (
                <div className="container mx-auto px-4 py-8 text-center">
                    <h1 className="text-2xl font-semibold mb-4">Welcome!</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Your account isn&apos;t linked to a family yet. Please complete your registration or contact
                        support.
                    </p>
                    {/* Optional: Add a link to registration or contact */}
                    {/* <Button asChild><Link to="/register/family-details">Complete Registration</Link></Button> */}
                </div>
            );
        }
        // Generic error display
        return <div className="text-red-500 p-4">Error loading family portal: {error}</div>;
    }

    // If family data is still loading or wasn't fetched (should be handled by error above now)
    if (!family) {
        return <div className="p-4">Loading family data...</div>; // Or a loading spinner
    }

    // Use the fetched family name or a generic fallback
    // We don't have profile.first_name here anymore
    const familyDisplayName = family.name || `Your Family Portal`;

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">Family Portal: {familyDisplayName}</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* My Students Section */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">My Students</h2>
                    {/* Display list of students or a message if none */}
                    {family.students && family.students.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-1 text-gray-700 dark:text-gray-300">
                            {family.students.map((student) => (
                                <li key={student.id} className="flex justify-between items-center">
                                    <Link
                                        to={`/family/student/${student.id}`}
                                        className="text-blue-600 hover:underline dark:text-blue-400"
                                    >
                                        {student.first_name} {student.last_name}
                                    </Link>
                                    {/* Display Eligibility Badge */}
                                    <Badge variant={getEligibilityBadgeVariant(student.eligibility.reason)}
                                           className="ml-2 text-xs">
                                        {student.eligibility.reason.startsWith('Paid') ? 'Active' : student.eligibility.reason}
                                        {/* Show last payment date for Paid or Expired */}
                                        {(student.eligibility.reason.startsWith('Paid') || student.eligibility.reason === 'Expired') && student.eligibility.lastPaymentDate &&
                                            ` (Last: ${format(new Date(student.eligibility.lastPaymentDate), 'MMM d')})`
                                        }
                                    </Badge>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-600 dark:text-gray-400">No students registered yet.</p>
                    )}
                    {/* Link to the new dedicated page for adding a student to the current family */}
                    <Button asChild className="mt-4">
                        <Link to="/family/add-student">Add Student</Link>
                    </Button>
                </div>

                {/* Guardians Section */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Guardians</h2>
                    {(!family.guardians || family.guardians.length < 1) && (
                         <Alert variant="destructive" className="mb-4">
                             <AlertCircle className="h-4 w-4"/>
                             <AlertTitle>No Guardians Found</AlertTitle>
                             <AlertDescription>
                                 Please add at least one guardian to manage the family account.
                             </AlertDescription>
                         </Alert>
                    )}
                    {family.guardians && family.guardians.length > 0 ? (
                        <ul className="list-disc pl-5 space-y-1 text-gray-700 dark:text-gray-300 mb-4">
                            {family.guardians.map((guardian) => (
                                <li key={guardian.id} className="flex justify-between items-center">
                                    {/* Link the name itself */}
                                    <Link
                                        to={`/family/guardian/${guardian.id}`}
                                        className="text-blue-600 hover:underline dark:text-blue-400"
                                    >
                                        {guardian.first_name} {guardian.last_name} ({guardian.relationship})
                                    </Link>
                                    {/* Optional: Keep a separate Edit link if preferred */}
                                    {/* <Link
                                        to={`/family/guardian/${guardian.id}`}
                                        className="text-blue-600 hover:underline dark:text-blue-400 text-sm ml-4"
                                    >
                                        View/Edit
                                    </Link> */}
                                </li>
                            ))}
                        </ul>
                    ) : (
                         <p className="text-gray-600 dark:text-gray-400 mb-4">No guardians added yet.</p>
                    )}
                     {/* Link to a future page for adding a guardian */}
                     <Button asChild className="mt-2">
                         {/* TODO: Create this route */}
                         <Link to="/family/add-guardian">Add Guardian</Link>
                     </Button>
                     {family.guardians && family.guardians.length === 1 && (
                         <p className="text-sm text-muted-foreground mt-3">
                             Consider adding a second guardian for backup contact purposes.
                         </p>
                     )}
                </div>

                {/* Individual Session Balance */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Individual Sessions</h2>
                    <p className="text-3xl font-bold mb-2">{individualSessionBalance ?? 0}</p>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Remaining Sessions</p>
                    {/* Optionally link to purchase more */}
                    {/* Remove asChild from Purchase More button for testing */}
                    <Button variant="secondary">
                        <Link to="/family/payment?option=individual">Purchase More</Link> {/* Corrected option value */}
                    </Button>
                </div>

                {/* Correct Waivers Section */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Waivers</h2>
                    {/* Display waiver status */}
                    {allWaiversSigned ? (
                        <p className="text-green-600 dark:text-green-400 mb-4">✅ All required waivers signed.</p>
                    ) : (
                        <p className="text-orange-600 dark:text-orange-400 mb-4">⚠️ Action required: Please sign all
                            waivers.</p>
                    )}
                    {/* Use asChild prop for correct Button/Link integration */}
                    <Button asChild className="mt-4">
                        <Link to="/waivers">View/Sign Waivers</Link>
                    </Button>
                </div>

                {/* Make New Payment Section */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Make a New Payment</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Proceed to make a payment for class fees.</p>
                    {family.students && family.students.length > 0 ? (
                        <Button asChild>
                            <Link to="/family/payment">Make Payment</Link>
                        </Button>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400 italic">Add a student to enable payments.</p>
                    )}
                </div>

                {/* Recent Payment Section */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Recent Payment</h2>
                    {family.payments && family.payments.length > 0 ? (
                        <div className="space-y-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                <span className="font-semibold">Date:</span> {family.payments[0].payment_date ? new Date(family.payments[0].payment_date).toLocaleDateString() : 'N/A'}
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                {/* Use total_amount for display */}
                                <span className="font-semibold">Amount:</span> ${(family.payments[0].total_amount / 100).toFixed(2)}
                            </p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                                <span className="font-semibold mr-2">Status:</span>
                                <span
                                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        family.payments[0].status === 'succeeded' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                            family.payments[0].status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                    }`}>
                                    {family.payments[0].status}
                                </span>
                            </p>
                            {/* Show receipt link only if status is succeeded and URL exists */}
                            {family.payments[0].status === 'succeeded' && family.payments[0].receipt_url && (
                                <p className="text-sm">
                                    <Link
                                        to={family.payments[0].receipt_url} // Use Link component and the internal URL
                                        target="_blank" // Optional: Keep opening in new tab
                                        rel="noopener noreferrer" // Keep for security
                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                        prefetch="intent" // Optional: Prefetch the receipt page
                                    >
                                        View Receipt
                                    </Link>
                                </p>
                            )}
                            <div className="pt-2">
                                <Button variant="link" className="p-0 h-auto text-sm">
                                    <Link to="/family/payment-history">View Full Payment History</Link>
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-600 dark:text-gray-400">No payment history found.</p>
                    )}
                </div>

                {/* Removed original combined Payments section */}

                {/* Account Settings Section - Moved to the end */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Update your family information and account
                        preferences.</p>
                    <Button asChild className="mt-4">
                        <Link to="/family/account">Manage Account</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
