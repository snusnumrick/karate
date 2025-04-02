import invariant from "tiny-invariant";
import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { Form, useLoaderData, useActionData, Link, useParams, useNavigation } from "@remix-run/react";
import { createClient } from "@supabase/supabase-js";
import { Database } from "~/types/supabase";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";

type FamilyRow = Database['public']['Tables']['families']['Row'];

// Define the shape of the data returned by the loader
type LoaderData = {
    family: FamilyRow;
};

// Define the shape of the data returned by the action
type ActionData = {
    success?: boolean;
    error?: string;
    fieldErrors?: {
        name?: string;
        email?: string;
        primary_phone?: string;
        // Add other fields as needed
    };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
    const familyName = data?.family?.name ?? "Edit Family";
    return [
        { title: `Edit ${familyName} | Admin Dashboard` },
        { name: "description", content: `Edit details for the ${familyName} family.` },
    ];
};

// Loader to fetch existing family data
export async function loader({ params, request }: LoaderFunctionArgs) {
    invariant(params.familyId, "Missing familyId parameter");
    const familyId = params.familyId;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("[Edit Loader] Missing Supabase URL or Service Role Key env vars.");
        throw new Response("Server configuration error", { status: 500 });
    }

    const supabaseServer = createClient<Database>(supabaseUrl, supabaseServiceKey);

    const { data: family, error } = await supabaseServer
        .from('families')
        .select('*')
        .eq('id', familyId)
        .single();

    if (error) {
        console.error(`[Edit Loader] Supabase error fetching family ${familyId}:`, error.message);
        throw new Response(`Database error: ${error.message}`, { status: 500 });
    }

    if (!family) {
        throw new Response("Family not found", { status: 404 });
    }

    return json({ family });
}

// Action to handle form submission for updating family data
export async function action({ request, params }: ActionFunctionArgs) {
    invariant(params.familyId, "Missing familyId parameter");
    const familyId = params.familyId;
    const formData = await request.formData();

    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const primary_phone = formData.get("primary_phone") as string | null;
    const secondary_phone = formData.get("secondary_phone") as string | null;
    const address = formData.get("address") as string | null;

    // Basic validation (consider using Zod for more complex validation)
    const fieldErrors: ActionData['fieldErrors'] = {};
    if (!name) fieldErrors.name = "Family name is required.";
    if (!email) fieldErrors.email = "Email is required.";
    // Add more validation rules as needed (e.g., email format, phone format)

    if (Object.keys(fieldErrors).length > 0) {
        return json<ActionData>({ error: "Validation failed", fieldErrors }, { status: 400 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("[Edit Action] Missing Supabase URL or Service Role Key env vars.");
        return json<ActionData>({ error: "Server configuration error" }, { status: 500 });
    }

    const supabaseServer = createClient<Database>(supabaseUrl, supabaseServiceKey);

    const { error } = await supabaseServer
        .from('families')
        .update({
            name,
            email,
            primary_phone: primary_phone || null, // Ensure null if empty
            secondary_phone: secondary_phone || null,
            address: address || null,
            // updated_at: new Date().toISOString(), // Optional: track updates
        })
        .eq('id', familyId);

    if (error) {
        console.error(`[Edit Action] Supabase error updating family ${familyId}:`, error.message);
        return json<ActionData>({ error: `Database error: ${error.message}` }, { status: 500 });
    }

    // Redirect back to the family detail page after successful update
    return redirect(`/admin/families/${familyId}`);
}


// Component for the Edit Family page
export default function EditFamilyPage() {
    const { family } = useLoaderData<LoaderData>();
    const actionData = useActionData<ActionData>();
    const navigation = useNavigation();
    const params = useParams();

    const isSubmitting = navigation.state === "submitting";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Edit Family: {family.name}</h1>
                {/* Top Cancel button removed */}
            </div>

            <Card>
            <CardHeader>
                    <CardTitle>Edit Family Details</CardTitle>
                    <CardDescription>Update the information for the {family.name} family.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form method="post" className="space-y-4">
                        {actionData?.error && !actionData.fieldErrors && (
                            <Alert variant="destructive">
                                <ExclamationTriangleIcon className="h-4 w-4" />
                                <AlertTitle>Error</AlertTitle>
                                <AlertDescription>{actionData.error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Family Name */}
                            <div className="space-y-2">
                                <Label htmlFor="name">Family Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    defaultValue={family.name}
                                    required
                                    aria-invalid={!!actionData?.fieldErrors?.name}
                                    aria-describedby="name-error"
                                />
                                {actionData?.fieldErrors?.name && (
                                    <p id="name-error" className="text-sm text-destructive">
                                        {actionData.fieldErrors.name}
                                    </p>
                                )}
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    defaultValue={family.email}
                                    required
                                    aria-invalid={!!actionData?.fieldErrors?.email}
                                    aria-describedby="email-error"
                                />
                                {actionData?.fieldErrors?.email && (
                                    <p id="email-error" className="text-sm text-destructive">
                                        {actionData.fieldErrors.email}
                                    </p>
                                )}
                            </div>

                            {/* Primary Phone */}
                            <div className="space-y-2">
                                <Label htmlFor="primary_phone">Primary Phone</Label>
                                <Input
                                    id="primary_phone"
                                    name="primary_phone"
                                    type="tel"
                                    defaultValue={family.primary_phone ?? ''}
                                    aria-invalid={!!actionData?.fieldErrors?.primary_phone}
                                    aria-describedby="primary_phone-error"
                                />
                                {actionData?.fieldErrors?.primary_phone && (
                                    <p id="primary_phone-error" className="text-sm text-destructive">
                                        {actionData.fieldErrors.primary_phone}
                                    </p>
                                )}
                            </div>

                            {/* Secondary Phone */}
                            <div className="space-y-2">
                                <Label htmlFor="secondary_phone">Secondary Phone</Label>
                                <Input
                                    id="secondary_phone"
                                    name="secondary_phone"
                                    type="tel"
                                    defaultValue={family.secondary_phone ?? ''}
                                />
                            </div>
                        </div>

                        {/* Address */}
                        <div className="space-y-2">
                            <Label htmlFor="address">Address</Label>
                            <Input
                                id="address"
                                name="address"
                                defaultValue={family.address ?? ''}
                            />
                        </div>

                        <Separator className="my-4" />

                        <div className="flex justify-end space-x-2">
                            <Button type="button" variant="outline" asChild>
                                <Link to={`/admin/families/${params.familyId}`}>Cancel</Link>
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}

// You might want a more specific Error Boundary for the edit page later
export { ErrorBoundary } from "./admin.families.$familyId";
