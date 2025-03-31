import { json, type LoaderFunctionArgs, TypedResponse } from "@remix-run/node";
import { Link, useLoaderData, Form } from "@remix-run/react";
import { getSupabaseServerClient } from "~/utils/supabase.server";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input"; // Assuming you'll need form inputs
import { Label } from "~/components/ui/label"; // Assuming you'll need labels

// Define expected loader data structure (adjust as needed)
interface LoaderData {
    familyName?: string;
    // Add other relevant data like guardian info, email, etc.
    error?: string;
}

// Placeholder loader - Fetch necessary account/family data
export async function loader({ request }: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> {
    const { supabaseServer, response } = getSupabaseServerClient(request);
    const headers = response.headers;
    const { data: { user } } = await supabaseServer.auth.getUser();

    if (!user) {
        // Redirect or error if not logged in (should be handled by layout)
        return json({ error: "User not authenticated" }, { status: 401, headers });
    }

    // Fetch profile to get family_id
    const { data: profileData, error: profileError } = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profileData || !profileData.family_id) {
        console.error("Error fetching profile or family_id for account page:", profileError?.message);
        return json({ error: "Failed to load user profile or family association." }, { status: 500, headers });
    }

    // Fetch family data using family_id
    const { data: familyData, error: familyError } = await supabaseServer
        .from('families')
        .select('name') // Fetch only the fields needed for display/editing initially
        .eq('id', profileData.family_id)
        .single();

    if (familyError || !familyData) {
        console.error("Error fetching family data for account page:", familyError?.message);
        return json({ error: "Failed to load family details." }, { status: 500, headers });
    }

    // TODO: Fetch guardian details if needed

    return json({ familyName: familyData.name }, { headers });
}

// Placeholder action - Handle form submissions for updating account info
// export async function action({ request }: ActionFunctionArgs) {
//   // ... handle form data, update Supabase, return response/errors
// }

export default function AccountSettingsPage() {
    const { familyName, error } = useLoaderData<typeof loader>();

    if (error) {
        return <div className="text-red-500 p-4">Error loading account settings: {error}</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <Link to="/family" className="text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Family Portal</Link>
            <h1 className="text-3xl font-bold mb-6">Account Settings</h1>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-semibold mb-4">Family Information</h2>
                {/* Example: Displaying family name */}
                <p className="mb-4">Current Family Name: <strong>{familyName || 'N/A'}</strong></p>
                {/* TODO: Add form elements to edit family name, address, etc. */}
                {/* Example Form Structure (needs proper implementation) */}
                {/*
                <Form method="post">
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="familyName">Family Name</Label>
                            <Input id="familyName" name="familyName" defaultValue={familyName || ''} />
                        </div>
                        <Button type="submit">Update Family Name</Button>
                    </div>
                </Form>
                */}
                <p className="text-gray-600 dark:text-gray-400 italic">Editing functionality coming soon.</p>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-semibold mb-4">Guardian Information</h2>
                {/* TODO: Fetch and display guardian details */}
                <p className="text-gray-600 dark:text-gray-400 italic">Guardian details and editing coming soon.</p>
                {/* TODO: Add form elements to add/edit guardians */}
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Account Preferences</h2>
                {/* TODO: Add options for email preferences, password change, etc. */}
                <p className="text-gray-600 dark:text-gray-400 italic">Account preference settings coming soon.</p>
            </div>
        </div>
    );
}
