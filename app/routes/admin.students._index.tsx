import {json} from "@remix-run/node";
import {Link, useLoaderData, useNavigate, useRouteError} from "@remix-run/react"; // Import useNavigate
import {createClient} from '@supabase/supabase-js';
import type {Database} from "~/types/database.types";
import {checkStudentEligibility, type EligibilityStatus} from "~/utils/supabase.server";
import {format} from 'date-fns';
import {Button} from "~/components/ui/button";
import {Badge} from "~/components/ui/badge";
import {beltColorMap} from "~/utils/constants"; // Import belt color map
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "~/components/ui/table";

// Define types for loader data
type StudentRow = Omit<Database['public']['Tables']['students']['Row'], 'belt_rank'>; // Omit removed column
type FamilyName = Pick<Database['public']['Tables']['families']['Row'], 'name'> | null;
type BeltRankEnum = Database['public']['Enums']['belt_rank_enum'];

// Extend the student type to include eligibility and current belt rank
type StudentWithFamilyEligibilityAndBelt = StudentRow & {
    families: FamilyName;
    eligibility: EligibilityStatus;
    currentBeltRank: BeltRankEnum | null; // Store the derived current rank
    lastGiPurchaseDate: string | null; // Add field for last Gi purchase date
};

export async function loader() {
    console.log("Entering /admin/students loader...");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Admin students loader: Missing Supabase URL or Service Role Key env variables.");
        throw new Response("Server configuration error.", {status: 500});
    }

    // Use service role client for admin data access
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // --- REMOVED FIRST TRY/CATCH BLOCK THAT RETURNED EARLY ---

    // --- Fetch Last Gi Purchase Dates ---
    // Fetch orders that are paid or completed to check for Gi purchases
    const { data: giPurchaseData, error: giError } = await supabaseAdmin
        .from('orders')
        .select(`
            id,
            student_id,
            created_at,
            order_items (
                product_variants (
                    products ( name )
                )
            )
        `)
        .or('status.eq.paid_pending_pickup,status.eq.completed') // Filter by paid OR completed orders
        // We need to filter based on the nested product name. Supabase doesn't directly support filtering on nested relations like this in a single query efficiently.
        // Fetching completed orders and filtering client-side might be inefficient if there are many orders.
        // Alternative: A database function or view.
        // For now, let's fetch orders and filter in code, acknowledging potential inefficiency.
        // Consider optimizing with a DB function if performance becomes an issue.
        .order('created_at', { ascending: false });

    if (giError) {
        console.error("Error fetching Gi purchase data:", giError.message);
        // Continue without Gi data, maybe log the error or return partial data
        // For simplicity, we'll proceed, and dates will be null.
    }

    const lastGiPurchaseMap = new Map<string, string>();
    if (giPurchaseData) {
        // Process orders to find the latest 'Gi' purchase date for each student
        for (const order of giPurchaseData) {
            // Check if this student already has a newer date recorded
            if (!order.student_id || lastGiPurchaseMap.has(order.student_id)) {
                continue; // Skip if no student ID or if we already found the latest for this student (due to ordering)
            }

            // Check if any item in this order is a 'Gi'
            let foundGiInOrder = false;
            for (const item of order.order_items) {
                 const productName = item.product_variants?.products?.name;
                 // Using includes('gi') is simple but might match unintended products (e.g., "Gifts").
                 // Consider a more specific check if product names allow (e.g., exact match, category, tag).
                 if (productName?.toLowerCase().includes('gi')) {
                     foundGiInOrder = true;
                     break; // Found a Gi, no need to check other items in this order
                 }
            }

            if (foundGiInOrder) {
                // Store the date of the most recent Gi purchase found so far for this student
                lastGiPurchaseMap.set(order.student_id, order.created_at);
            }
        }
    }
    // --- End Fetch Last Gi Purchase Dates ---


    try {
        console.log("Admin students loader - Fetching all students and related family names using service role...");
        // Fetch student data and related family name
        const {data: students, error} = await supabaseAdmin
            .from('students')
            .select(`
        *,
        families ( name )
      `) // Fetch name from the related families table
            .order('last_name', {ascending: true})
            .order('first_name', {ascending: true});

        if (error) {
            console.error("Error fetching students:", error.message);
            throw new Response("Failed to load student data.", {status: 500});
        }

        console.log(`Admin students loader - Fetched ${students?.length ?? 0} students. Now checking eligibility, latest belt, and mapping Gi dates...`);

        // Fetch eligibility and latest belt for each student
        const studentsWithDetails: StudentWithFamilyEligibilityAndBelt[] = [];
        if (students) {
            for (const student of students) {
                // Fetch eligibility
                const eligibility = await checkStudentEligibility(student.id, supabaseAdmin);

                // Fetch the latest belt award for the student
                const {data: latestBeltAward, error: beltError} = await supabaseAdmin
                    .from('belt_awards')
                    .select('type') // Select only the type (rank)
                    .eq('student_id', student.id)
                    .order('awarded_date', {ascending: false})
                    .limit(1)
                    .maybeSingle(); // Use maybeSingle to handle cases with no awards

                if (beltError) {
                    console.error(`Error fetching latest belt for student ${student.id}:`, beltError.message);
                    // Decide how to handle error: skip student, show 'Error', or null? Let's use null.
                }

                // Get last Gi purchase date from the map
                const lastGiPurchaseDate = lastGiPurchaseMap.get(student.id) ?? null;

                studentsWithDetails.push({
                    ...student,
                    families: student.families ?? null,
                    eligibility: eligibility,
                    currentBeltRank: latestBeltAward?.type ?? null, // Store the rank or null
                    lastGiPurchaseDate: lastGiPurchaseDate, // Add the date here
                });
            }
        }

        console.log("Admin students loader - Eligibility, belt checks, and Gi date mapping complete.");
        return json({students: studentsWithDetails});

    } catch (error) {
        if (error instanceof Error) {
            console.error("Error in /admin/students loader:", error.message);
            throw new Response(error.message, {status: 500});
        } else {
            console.error("Unknown error in /admin/students loader:", error);
            throw new Response("An unknown error occurred.", {status: 500});
        }
    }
}

export default function StudentsAdminPage() {
    const {students} = useLoaderData<{ students: StudentWithFamilyEligibilityAndBelt[] }>(); // Update type
    const navigate = useNavigate(); // Get navigate function

    // Helper to determine badge variant based on eligibility (Updated reasons)
    const getEligibilityBadgeVariant = (status: EligibilityStatus['reason']): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case 'Paid - Monthly':
            case 'Paid - Yearly':
                return 'default'; // Use default (often primary/blue) for active paid status
            case 'Trial':
                return 'secondary';
            case 'Expired':
                return 'destructive'; // Changed from 'Not Paid'
            default:
                return 'outline';
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Manage Students</h1>
                <Button asChild>
                    {/* Link to a future add student page */}
                    <Link to="/admin/students/new">Add New Student</Link>
                </Button>
            </div>

            {students.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">No students found.</p>
            ) : (
                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Student Name</TableHead>
                                <TableHead>Family Name</TableHead>
                                <TableHead>Current Belt</TableHead> {/* Changed header */}
                                <TableHead>Eligibility</TableHead>
                                <TableHead>Last Gi Purchase</TableHead> {/* New header */}
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {students.map((student) => (
                                <TableRow key={student.id}>
                                    <TableCell
                                        className="font-medium">{`${student.first_name} ${student.last_name}`}</TableCell>
                                    <TableCell>{student.families?.name ?? 'N/A'}</TableCell>
                                    <TableCell>
                                        {student.currentBeltRank ? (
                                            <div className="flex items-center">
                                                <div
                                                    className={`h-4 w-8 rounded mr-2 ${beltColorMap[student.currentBeltRank] || 'bg-gray-400'}`}></div>
                                                <span className="capitalize">{student.currentBeltRank}</span>
                                            </div>
                                        ) : (
                                            'N/A'
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getEligibilityBadgeVariant(student.eligibility.reason)}
                                               className="text-xs">
                                            + {(student.eligibility.reason === 'Paid - Monthly' || student.eligibility.reason === 'Paid - Yearly') ? 'Active' : student.eligibility.reason}
                                            {/* Optionally show last payment date for Paid/Expired */}
                                            {student.eligibility.lastPaymentDate && (student.eligibility.reason === 'Paid - Monthly' || student.eligibility.reason === 'Paid - Yearly' || student.eligibility.reason
                                                    === 'Expired') &&
                                                ` (Last: ${format(new Date(student.eligibility.lastPaymentDate), 'yyyy-MM-dd')})` // Keep date format for admin view
                                            }
                                        </Badge>
                                    </TableCell>
                                    <TableCell> {/* New cell for Gi purchase date */}
                                        {student.lastGiPurchaseDate
                                            ? format(new Date(student.lastGiPurchaseDate), 'yyyy-MM-dd')
                                            : 'N/A'}
                                    </TableCell>
                                    <TableCell className="space-x-2 whitespace-nowrap">
                                        {/* Use onClick with navigate instead of asChild/Link */}
                                        <Button variant="outline" size="sm"
                                                onClick={() => navigate(`/admin/students/${student.id}`)}>
                                            View/Edit
                                        </Button>
                                        {/* Use onClick with navigate instead of asChild/Link */}
                                        <Button variant="secondary" size="sm"
                                                onClick={() => navigate(`/admin/student-belts/${student.id}`)}>
                                            Belts
                                        </Button>
                                        {/* Add delete button/logic here if needed */}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}

// Add a specific ErrorBoundary for this route
export function ErrorBoundary() {
    const error = useRouteError();
    console.error("Error caught in StudentsAdminPage ErrorBoundary:", error);

    let errorMessage = "An unknown error occurred.";
    let errorStack = undefined;
    if (error instanceof Response) {
        errorMessage = `Error: ${error.status} - ${error.statusText || 'Failed to load data.'}`;
    } else if (error instanceof Error) {
        errorMessage = error.message;
        errorStack = error.stack;
    }

    // Simplified return for debugging the React.Children.only error
    return (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <h2 className="text-xl font-bold mb-2">Error Loading Students</h2>
            <p>{errorMessage}</p>
            {process.env.NODE_ENV === "development" && errorStack && (
                <pre className="mt-4 p-2 bg-red-50 text-red-900 rounded-md max-w-full overflow-auto text-xs">
          {String(errorStack)}
        </pre>
            )}
            {process.env.NODE_ENV === "development" && error instanceof Response && (
                <pre className="mt-4 p-2 bg-red-50 text-red-900 rounded-md max-w-full overflow-auto text-xs">
           {`Status: ${error.status} ${error.statusText}`}
         </pre>
            )}
        </div>
    );
}
