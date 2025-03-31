import { json, type LoaderFunctionArgs, TypedResponse } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getSupabaseServerClient, checkStudentEligibility, type EligibilityStatus } from "~/utils/supabase.server"; // Import eligibility check
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge"; // Import Badge
import { Link } from "@remix-run/react";
import { Database } from "~/types/supabase";
import { format } from 'date-fns'; // For formatting dates

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
};

interface LoaderData {
    profile?: { familyId: string };
    family?: FamilyData;
    error?: string;
    allWaiversSigned?: boolean;
}

// Placeholder loader - will need to fetch actual family data later
export async function loader({request}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const {supabaseServer, response} = getSupabaseServerClient(request);
    const headers = response.headers;
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        // This shouldn't happen if the route is protected by the layout,
        // but good practice to handle it.
        // Consider redirecting to login if needed, depending on layout setup.
        return json({ error: "User not authenticated"}, {status: 401, headers});
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
        // User is logged in but not associated with a family yet
        // This might happen after registration but before family creation/linking
        // TODO: Consider redirecting to a family setup/linking page or showing a specific message
        return json({
            error: "No family associated with this account.",
        }, {headers});
    }

    // 2. Fetch the family data *and* its related students and payments using the family_id from the profile
    const {data: familyData, error: familyError} = await supabaseServer
        .from('families')
        // Fetch family details, related students, and related payments (ordered by date descending)
        .select(`
          *,
          students(*),
          payments(*, payment_students(student_id))
        `)
        .eq('id', profileData.family_id)
        .order('payment_date', {
            foreignTable: 'payments',
            ascending: false,
            nullsFirst: false
        }) // Order payments by date
        .single(); // Fetch raw data first

    if (familyError || !familyData) { // Check if familyData itself is null/undefined
        console.error("Error fetching family data:", familyError?.message ?? "Family not found");
        return json({
            profile: { familyId: String(profileData.family_id) },
            error: "Failed to load family data.",
            allWaiversSigned: false
        }, { status: 500, headers });
    }

    // 3. Fetch eligibility for each student IN the fetched family data
    const studentsWithEligibility: StudentWithEligibility[] = [];
    if (familyData.students && familyData.students.length > 0) {
        for (const student of familyData.students) {
            const eligibility = await checkStudentEligibility(student.id, supabaseServer); // Use supabaseServer (service role)
            studentsWithEligibility.push({
                ...student,
                eligibility: eligibility,
            });
        }
    }

    // Replace the original students array with the one containing eligibility
    const familyDataWithEligibility: FamilyData = {
        ...familyData,
        students: studentsWithEligibility,
    };


    // 4. Fetch required waivers and user's signatures to determine status
    let allWaiversSigned = false;
    try {
        const {data: requiredWaivers, error: requiredWaiversError} = await supabaseServer
            .from('waivers')
            .select('id')
            .eq('required', true);

        if (requiredWaiversError) throw requiredWaiversError;

        // If there are no required waivers, consider them "signed"
        if (!requiredWaivers || requiredWaivers.length === 0) {
            allWaiversSigned = true;
        } else {
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
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Error checking waiver status:", error.message);
        } else {
            console.error("Error checking waiver status:", error);
        }
        // Default to false if there's an error checking status, but don't block portal load
        allWaiversSigned = false;
    }

    // console.log('Family data with eligibility:', familyDataWithEligibility);

    // Return profile, family data (with eligibility), and waiver status
    return json({
        profile: { familyId: String(profileData.family_id) },
        family: familyDataWithEligibility, // Use the updated data
        allWaiversSigned
    }, { headers });
}


// Helper function for badge variants (can be moved to utils if reused)
const getEligibilityBadgeVariant = (status: EligibilityStatus['reason']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
        case 'Paid': return 'default'; // Greenish
        case 'Trial': return 'secondary'; // Bluish/Grayish
        case 'Expired': return 'destructive'; // Reddish
        default: return 'outline';
    }
};

export default function FamilyPortal() {
    // Now loader returns profile, family data, and waiver status
    const {family, error, allWaiversSigned} = useLoaderData<typeof loader>();

    // Handle specific error messages from the loader
    if (error) {
        // Special handling if no family is associated yet
        if (error === "No family associated with this account.") {
            return (
                <div className="container mx-auto px-4 py-8 text-center">
                    <h1 className="text-2xl font-semibold mb-4">Welcome!</h1>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">
                        Your account isn't linked to a family yet. Please complete your registration or contact support.
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
                {/* TODO: Implement these sections using actual data */}
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
                                    <Badge variant={getEligibilityBadgeVariant(student.eligibility.reason)} className="ml-2 text-xs">
                                        {student.eligibility.reason}
                                        {student.eligibility.reason === 'Paid' && student.eligibility.lastPaymentDate &&
                                            ` (Paid ${format(new Date(student.eligibility.lastPaymentDate), 'MMM d')})`
                                        }
                                        {student.eligibility.reason === 'Expired' && student.eligibility.lastPaymentDate &&
                                            ` (Last Paid ${format(new Date(student.eligibility.lastPaymentDate), 'MMM d')})`
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

                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Waivers</h2>
                    {/* Display waiver status */}
                    {allWaiversSigned ? (
                        <p className="text-green-600 dark:text-green-400 mb-4">✅ All required waivers signed.</p>
                    ) : (
                        <p className="text-orange-600 dark:text-orange-400 mb-4">⚠️ Action required: Please sign all
                            waivers.</p>
                    )}
                    {/* TODO: Re-evaluate Button/Link structure after resolving SSR issues */}
                    <Button className="mt-4">
                        <Link to="/waivers">View/Sign Waivers</Link>
                    </Button>
                </div>

                <div
                    className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow md:col-span-2"> {/* Span across both columns on medium screens */}
                    <h2 className="text-xl font-semibold mb-4">Payments</h2>

                    {/* Payment Initiation Button */}
                    <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium mb-2">Make a New Payment</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">Proceed to make a payment for class
                            fees.</p>
                        {family.students && family.students.length > 0 ? (
                            <Button asChild>
                                <Link to="/family/payment">Make Payment</Link>
                            </Button>
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 italic">Add a student to enable payments.</p>
                        )}
                    </div>

                    {/* Payment History Section */}
                    <div>
                        <h3 className="text-lg font-medium mb-4">Recent Payment</h3>
                        {family.payments && family.payments.length > 0 ? (
                            // Display only the most recent payment (first in the sorted list)
                            (() => {
                                const latestPayment = family.payments[0];
                                return (
                                    <div className="space-y-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-md">
                                        <p className="text-sm text-gray-700 dark:text-gray-300">
                                            <span
                                                className="font-semibold">Date:</span> {latestPayment.payment_date ? new Date(latestPayment.payment_date).toLocaleDateString() : 'N/A'}
                                        </p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300">
                                            <span
                                                className="font-semibold">Amount:</span> ${(latestPayment.amount / 100).toFixed(2)}
                                        </p>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center">
                                            <span className="font-semibold mr-2">Status:</span>
                                            <span
                                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                    latestPayment.status === 'succeeded' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                        latestPayment.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                            'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                }`}>
                        {latestPayment.status}
                      </span>
                                        </p>
                                        {latestPayment.receipt_url && (
                                            <p className="text-sm">
                                                <a
                                                    href={latestPayment.receipt_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                                                >
                                                    View Receipt
                                                </a>
                                            </p>
                                        )}
                                        {/* Link to full history page */}
                                        <div className="pt-2">
                                            <Button variant="link" asChild className="p-0 h-auto text-sm">
                                                <Link to="/family/payment-history">View Full Payment History</Link>
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })()
                        ) : (
                            <p className="text-gray-600 dark:text-gray-400">No payment history found.</p>
                        )}
                    </div>
                </div>

                {/* Account Settings Section - Remains unchanged */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
                    {/* TODO: Link to profile/account management */}
                    <p className="text-gray-600 dark:text-gray-400">Links to update family/guardian info.</p>
                    <Button className="mt-4" disabled>
                        {/* <Link to="/account">Manage Account</Link> */}
                        <span>Manage Account (Coming Soon)</span>
                    </Button>
                </div>
            </div>
        </div>
    );
}
