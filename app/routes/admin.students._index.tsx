import {json} from "@remix-run/node";
import {Link, useLoaderData, useNavigate, useRouteError} from "@remix-run/react"; // Import useNavigate
import {getSupabaseAdminClient} from '~/utils/supabase.server';
import type {Database} from "~/types/database.types";
import type {EligibilityStatus} from "~/types/payment";
import {formatDate} from "~/utils/misc"; // Import formatDate utility
import {Button} from "~/components/ui/button";

import {beltColorMap} from "~/utils/constants"; // Import belt color map
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "~/components/ui/table";
import {AppBreadcrumb, breadcrumbPatterns} from "~/components/AppBreadcrumb";

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

    const supabaseAdmin = getSupabaseAdminClient();

    try {
        console.log("Admin students loader - Fetching all students and related family names using service role...");
        // Fetch student data, related family name, belt awards, and gi purchases
        const {data: students, error} = await supabaseAdmin
            .from('students')
            .select(`
        *,
        families ( name ),
        belt_awards (
          id,
          type,
          awarded_date
        )
      `) // Fetch name from the related families table and belt awards
            .order('last_name', {ascending: true})
            .order('first_name', {ascending: true});

        if (error) {
            console.error("Error fetching students:", error.message);
            throw new Response("Failed to load student data.", {status: 500});
        }

        // Fetch all gi purchases from orders table
        // Join through order_items and product_variants to get products with 'gi' in the name
        const {data: giPurchases, error: giError} = await supabaseAdmin
            .from('orders')
            .select(`
        id,
        student_id,
        order_date,
        order_items!inner (
          product_variant_id,
          product_variants!inner (
            product_id,
            products!inner (
              name
            )
          )
        )
      `)
            .not('student_id', 'is', null);

        if (giError) {
            console.error("Error fetching gi purchases:", giError.message);
            // Don't throw, just log and continue without gi data
        }

        // Filter orders that contain gi products
        const giOrdersWithStudents = giPurchases?.filter(order =>
            order.order_items?.some(item =>
                item.product_variants?.products?.name?.toLowerCase().includes('gi')
            )
        ) || [];

        // Process students to add current belt rank and last gi purchase date
        const studentsWithData = students?.map(student => {
            // Find the most recent belt award
            const sortedBelts = student.belt_awards?.sort((a, b) =>
                new Date(b.awarded_date).getTime() - new Date(a.awarded_date).getTime()
            ) || [];
            const currentBeltRank = sortedBelts[0]?.type || null;

            // Find the most recent gi purchase for this student from orders
            const studentGiOrders = giOrdersWithStudents?.filter(order =>
                order.student_id === student.id
            ) || [];
            const sortedGiOrders = studentGiOrders.sort((a, b) =>
                new Date(b.order_date || 0).getTime() - new Date(a.order_date || 0).getTime()
            );
            const lastGiPurchaseDate = sortedGiOrders[0]?.order_date || null;

            return {
                ...student,
                currentBeltRank,
                lastGiPurchaseDate
            };
        }) || [];

        return json({students: studentsWithData});

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
    const {students} = useLoaderData<{ students: StudentWithFamilyEligibilityAndBelt[] }>();
    const navigate = useNavigate(); // Get navigate function



    return (
        <div className="container mx-auto px-4 py-8">
            <AppBreadcrumb 
                items={breadcrumbPatterns.adminStudents()}
                className="mb-6"
            />
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

                                    <TableCell> {/* New cell for Gi purchase date */}
                                        {student.lastGiPurchaseDate
                                            ? formatDate(student.lastGiPurchaseDate, { formatString: 'yyyy-MM-dd' })
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
