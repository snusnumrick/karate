import {json, TypedResponse} from "@remix-run/node";
import {Link, useLoaderData, useRouteError} from "@remix-run/react";
import {createClient} from '@supabase/supabase-js';
import type {Database} from "~/types/database.types";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow,} from "~/components/ui/table";

// Define types
type ProfileRow = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'email' | 'family_id'>;
type WaiverRow = Pick<Database['public']['Tables']['waivers']['Row'], 'id' | 'title'>;
type FamilyRow = Pick<Database['public']['Tables']['families']['Row'], 'id' | 'name'>;

type FamilyMissingWaivers = {
    family: FamilyRow;
    missingWaivers: WaiverRow[];
    usersInFamily: ProfileRow[];
};

type LoaderData = {
    familiesMissingWaivers: FamilyMissingWaivers[];
};

export async function loader(): Promise<TypedResponse<LoaderData>> {
    console.log("Entering /admin/waivers/missing loader...");

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Admin missing waivers loader: Missing Supabase env variables.");
        throw new Response("Server configuration error.", {status: 500});
    }
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Fetch all required waivers
        const {data: requiredWaivers, error: waiversError} = await supabaseAdmin
            .from('waivers')
            .select('id, title')
            .eq('required', true);
        if (waiversError) throw new Error(`Failed to fetch required waivers: ${waiversError.message}`);
        if (!requiredWaivers || requiredWaivers.length === 0) {
            // No required waivers, so no families are missing any
            return json({familiesMissingWaivers: []});
        }
        const requiredWaiverMap = new Map(requiredWaivers.map(w => [w.id, w]));

        // 2. Fetch all user profiles (excluding admin/instructor roles if necessary) and their family names
        const {data: profiles, error: profilesError} = await supabaseAdmin
            .from('profiles')
            .select('id, email, family_id, families ( name )') // Fetch family name
            .eq('role', 'user'); // Assuming 'user' role represents family members
        if (profilesError) throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
        if (!profiles) {
            return json({familiesMissingWaivers: []}); // No families to check
        }

        // 3. Fetch all waiver signatures for the required waivers
        const {data: signatures, error: signaturesError} = await supabaseAdmin
            .from('waiver_signatures')
            .select('user_id, waiver_id')
            .in('waiver_id', Array.from(requiredWaiverMap.keys()));
        if (signaturesError) throw new Error(`Failed to fetch signatures: ${signaturesError.message}`);

        // 4. Process data to find families missing waivers
        const signaturesByUser = new Map<string, Set<string>>(); // Map<user_id, Set<waiver_id>>
        (signatures ?? []).forEach(sig => {
            if (!signaturesByUser.has(sig.user_id)) {
                signaturesByUser.set(sig.user_id, new Set());
            }
            signaturesByUser.get(sig.user_id)!.add(sig.waiver_id);
        });

        // Group profiles by family
        const familiesMap = new Map<string, { family: FamilyRow; users: ProfileRow[] }>();
        for (const profile of profiles) {
            if (!profile.family_id) continue; // Skip users without family
            
            if (!familiesMap.has(profile.family_id)) {
                familiesMap.set(profile.family_id, {
                    family: {
                        id: profile.family_id,
                        name: profile.families?.name || 'Unknown Family'
                    },
                    users: []
                });
            }
            familiesMap.get(profile.family_id)!.users.push(profile);
        }

        const familiesMissingWaivers: FamilyMissingWaivers[] = [];
        for (const [, familyData] of familiesMap) {
            // Check if any user in the family is missing any required waiver
            const familyMissingWaivers = new Set<string>();
            
            for (const user of familyData.users) {
                const signedWaivers = signaturesByUser.get(user.id) ?? new Set();
                for (const requiredWaiver of requiredWaivers) {
                    if (!signedWaivers.has(requiredWaiver.id)) {
                        familyMissingWaivers.add(requiredWaiver.id);
                    }
                }
            }

            if (familyMissingWaivers.size > 0) {
                const missingWaivers = requiredWaivers.filter(w => familyMissingWaivers.has(w.id));
                familiesMissingWaivers.push({
                    family: familyData.family,
                    missingWaivers,
                    usersInFamily: familyData.users,
                });
            }
        }

        console.log(`Found ${familiesMissingWaivers.length} families missing required waivers.`);
        return json({familiesMissingWaivers});

    } catch (error) {
        const message = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Error in /admin/waivers/missing loader:", message);
        throw new Response(message, {status: 500});
    }
}


export default function MissingWaiversPage() {
    const {familiesMissingWaivers} = useLoaderData<LoaderData>();

    return (
        <div className="container mx-auto px-4 py-8">
            <Link to="/admin" className="text-blue-600 hover:underline mb-4 inline-block">
                &larr; Back to Admin Dashboard
            </Link>
            <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">Families Missing Required Waivers</h1>

            {familiesMissingWaivers.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400">All families have signed the required waivers.</p>
            ) : (
                <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Family Name</TableHead>
                                <TableHead>Family Members</TableHead>
                                <TableHead>Missing Waivers</TableHead>
                                {/* Add Actions column if needed (e.g., Send Reminder) */}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {familiesMissingWaivers.map((familyData) => (
                                <TableRow key={familyData.family.id}>
                                    <TableCell className="font-medium">
                                        <Link 
                                            to={`/admin/families/${familyData.family.id}`}
                                            className="text-green-600 hover:underline dark:text-green-400"
                                        >
                                            {familyData.family.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <ul className="text-sm">
                                            {familyData.usersInFamily.map(user => (
                                                <li key={user.id}>{user.email}</li>
                                            ))}
                                        </ul>
                                    </TableCell>
                                    <TableCell>
                                        <ul className="list-disc pl-5 text-sm">
                                            {familyData.missingWaivers.map(waiver => (
                                                <li key={waiver.id}>{waiver.title}</li>
                                            ))}
                                        </ul>
                                    </TableCell>
                                    {/* Add Actions Cell if needed */}
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
    console.error("Error caught in MissingWaiversPage ErrorBoundary:", error);

    let errorMessage = "An unknown error occurred loading missing waiver data.";
    let errorStatus = 500;

    if (error instanceof Response) {
        errorMessage = `Error: ${error.status} - ${error.statusText || 'Failed to load data.'}`;
        errorStatus = error.status;
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <Link to="/admin" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Admin
                Dashboard</Link>
            <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                <h2 className="text-xl font-bold mb-2">Error Loading Missing Waivers ({errorStatus})</h2>
                <p>{errorMessage}</p>
            </div>
        </div>
    );
}
