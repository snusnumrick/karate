import {type ActionFunctionArgs, json, type MetaFunction, redirect} from "@remix-run/node";
import {Form, Link, useActionData, useLoaderData, useNavigation} from "@remix-run/react";
import {Database} from "~/types/database.types";
import { getSupabaseAdminClient } from "~/utils/supabase.server";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { csrf } from "~/utils/csrf.server";

import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input";
import {Label} from "~/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "~/components/ui/select";
import {Textarea} from "~/components/ui/textarea";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {BELT_RANKS} from "~/utils/constants";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "~/components/ui/card";
import {ExclamationTriangleIcon} from "@radix-ui/react-icons";
import { AppBreadcrumb, breadcrumbPatterns } from "~/components/AppBreadcrumb";
import { T_SHIRT_SIZE_OPTIONS } from "~/constants/tShirtSizes";

// Loader to get all families for the dropdown
export async function loader() {
    const supabaseServer = getSupabaseAdminClient();

    // Fetch all families for the dropdown
    const {data: families, error: familiesError} = await supabaseServer
        .from('families')
        .select('id, name')
        .order('name', { ascending: true });

    if (familiesError) {
        console.error("[Admin Add Student Loader] Error fetching families:", familiesError.message);
        throw new Response("Failed to load families", {status: 500});
    }

    return json({families: families || []});
}

export const meta: MetaFunction = () => {
    return [
        {title: "Add New Student | Admin Dashboard"},
        {name: "description", content: "Add a new student to the system."},
    ];
};

// Action function to handle adding the student
export async function action({request}: ActionFunctionArgs) {
    await csrf.validate(request);
    const formData = await request.formData();

    const supabaseServer = getSupabaseAdminClient();

    // Extract student data from form
    const familyId = formData.get("familyId") as string;
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const birthDate = formData.get("birthDate") as string;
    const gender = formData.get("gender") as string;
    const tShirtSize = formData.get("tShirtSize") as string;
    const height = formData.get("height") as string | null;
    const school = formData.get("school") as string;
    const gradeLevel = formData.get("gradeLevel") as string;
    // Optional fields
    const specialNeeds = formData.get("specialNeeds") as string | null;
    const allergies = formData.get("allergies") as string | null;
    const medications = formData.get("medications") as string | null;
    const immunizationsUpToDate = formData.get("immunizationsUpToDate") as string | null;
    const immunizationNotes = formData.get("immunizationNotes") as string | null;
    const beltRank = formData.get("beltRank") as string | null;
    const email = formData.get("email") as string | null;
    const cellPhone = formData.get("cellPhone") as string | null;

    // Basic validation
    const fieldErrors: Record<string, string> = {};
    if (!familyId) fieldErrors.familyId = "Family is required.";
    if (!firstName) fieldErrors.firstName = "First name is required.";
    if (!lastName) fieldErrors.lastName = "Last name is required.";
    if (!birthDate) fieldErrors.birthDate = "Birth date is required.";
    if (!gender) fieldErrors.gender = "Gender is required.";
    if (!tShirtSize) fieldErrors.tShirtSize = "T-Shirt size is required.";
    if (height && (isNaN(parseInt(height)) || parseInt(height) < 50 || parseInt(height) > 250)) {
        fieldErrors.height = "Height must be between 50 and 250 cm.";
    }
    if (!school) fieldErrors.school = "School is required.";
    if (!gradeLevel) fieldErrors.gradeLevel = "Grade level is required.";

    if (Object.keys(fieldErrors).length > 0) {
        return json<{
            error: string;
            fieldErrors: typeof fieldErrors;
            formData: Record<string, string>
        }>({
            error: "Please fill in all required fields.",
            fieldErrors,
            formData: Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, typeof value === 'string' ? value : '']))
        }, {status: 400});
    }

    try {
        const {data: newStudent, error: studentInsertError} = await supabaseServer.from('students').insert({
            family_id: familyId,
            first_name: firstName,
            last_name: lastName,
            gender: gender,
            birth_date: birthDate,
            t_shirt_size: tShirtSize as Database['public']['Enums']['t_shirt_size_enum'],
            height: height ? parseInt(height) : null,
            school: school,
            grade_level: gradeLevel,
            special_needs: specialNeeds || null,
            allergies: allergies || null,
            medications: medications || null,
            immunizations_up_to_date: immunizationsUpToDate || null,
            immunization_notes: immunizationNotes || null,
            belt_rank: beltRank as typeof BELT_RANKS[number] | null,
            email: email || null,
            cell_phone: cellPhone || null,
        }).select().single();

        if (studentInsertError) {
            console.error("[Admin Add Student Action] Error inserting student:", studentInsertError);
            throw studentInsertError;
        }

        console.log(`[Admin Add Student Action] Successfully added student ${newStudent?.id} to family ${familyId}`);
        
        // Redirect back to the admin students page on success
        return redirect(`/admin/students`);

    } catch (error: unknown) {
        console.error('[Admin Add Student Action] Add student error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to add student. Please try again.';
        
        return json<{ error: string; fieldErrors: typeof fieldErrors; formData: Record<string, string> }>({
            error: errorMessage,
            fieldErrors,
            formData: Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, typeof value === 'string' ? value : '']))
        }, {status: 500});
    }
}

export default function AdminAddStudentPage() {
    const {families} = useLoaderData<typeof loader>();
    const actionData = useActionData<{
        error: string;
        fieldErrors: Record<string, string>;
        formData: Record<string, string>;
    }>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    // Helper to get default value from actionData if available
    const getFormData: (key: string) => string = (key: string) => (actionData && 'formData' in actionData ? (actionData.formData as Record<string, string>)[key] : '');
    const getFieldError: (key: string) => string | undefined = (key: string) => actionData?.fieldErrors?.[key];

    return (
        <div className="space-y-6">
            <AppBreadcrumb 
                items={breadcrumbPatterns.adminStudentNew()} 
                className="mb-6"
            />
            
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Add New Student</h1>
                <Button asChild variant="outline" size="sm">
                    <Link to="/admin/students">Cancel</Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Student Details</CardTitle>
                    <CardDescription>Enter the information for the new student.</CardDescription>
                </CardHeader>
                <CardContent>
                    {actionData?.error && (
                        <Alert variant="destructive" className="mb-4">
                            <ExclamationTriangleIcon className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{actionData.error}</AlertDescription>
                        </Alert>
                    )}

                    <Form method="post" className="space-y-4">
                        <AuthenticityTokenInput />
                        {/* Family Selection */}
                        <div className="space-y-2">
                            <Label htmlFor="familyId">Family *</Label>
                            <Select name="familyId" defaultValue={getFormData("familyId")}>
                                <SelectTrigger className="input-custom-styles">
                    <SelectValue placeholder="Select a family" />
                </SelectTrigger>
                                <SelectContent>
                                    {families.map((family) => (
                                        <SelectItem key={family.id} value={family.id}>
                                            {family.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {getFieldError("familyId") && (
                                <p className="text-sm text-red-600">{getFieldError("familyId")}</p>
                            )}
                        </div>

                        {/* Basic Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">First Name *</Label>
                                <Input
                                    id="firstName"
                                    name="firstName"
                                    type="text"
                                    defaultValue={getFormData("firstName")}
                                    required
                                    className="input-custom-styles"
                                />
                                {getFieldError("firstName") && (
                                    <p className="text-sm text-red-600">{getFieldError("firstName")}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="lastName">Last Name *</Label>
                                <Input
                                    id="lastName"
                                    name="lastName"
                                    type="text"
                                    defaultValue={getFormData("lastName")}
                                    required
                                    className="input-custom-styles"
                                />
                                {getFieldError("lastName") && (
                                    <p className="text-sm text-red-600">{getFieldError("lastName")}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="birthDate">Birth Date *</Label>
                                <Input
                                    id="birthDate"
                                    name="birthDate"
                                    type="date"
                                    defaultValue={getFormData("birthDate")}
                                    required
                                    className="input-custom-styles"
                                />
                                {getFieldError("birthDate") && (
                                    <p className="text-sm text-red-600">{getFieldError("birthDate")}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="gender">Gender *</Label>
                                <Select name="gender" defaultValue={getFormData("gender")}>
                                    <SelectTrigger className="input-custom-styles">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Male">Male</SelectItem>
                                        <SelectItem value="Female">Female</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                                {getFieldError("gender") && (
                                    <p className="text-sm text-red-600">{getFieldError("gender")}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="school">School *</Label>
                                <Input
                                    id="school"
                                    name="school"
                                    type="text"
                                    defaultValue={getFormData("school")}
                                    required
                                    className="input-custom-styles"
                                />
                                {getFieldError("school") && (
                                    <p className="text-sm text-red-600">{getFieldError("school")}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="gradeLevel">Grade Level *</Label>
                                <Input
                                    id="gradeLevel"
                                    name="gradeLevel"
                                    type="text"
                                    defaultValue={getFormData("gradeLevel")}
                                    required
                                    className="input-custom-styles"
                                />
                                {getFieldError("gradeLevel") && (
                                    <p className="text-sm text-red-600">{getFieldError("gradeLevel")}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="tShirtSize">T-Shirt Size *</Label>
                                <Select name="tShirtSize" defaultValue={getFormData("tShirtSize")}>
                                    <SelectTrigger className="input-custom-styles">
                  <SelectValue placeholder="Select size" />
                </SelectTrigger>
                                    <SelectContent>
                                        {T_SHIRT_SIZE_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {getFieldError("tShirtSize") && (
                                    <p className="text-sm text-red-600">{getFieldError("tShirtSize")}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="height">Height (cm)</Label>
                                <Input 
                                    type="number" 
                                    id="height" 
                                    name="height" 
                                    min="50" 
                                    max="250" 
                                    className="input-custom-styles" 
                                    placeholder="e.g., 150"
                                    defaultValue={getFormData("height")}
                                />
                                {getFieldError("height") && (
                                    <p className="text-sm text-red-600">{getFieldError("height")}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="beltRank">Current Belt Rank</Label>
                                <Select name="beltRank" defaultValue={getFormData("beltRank")}>
                                    <SelectTrigger className="input-custom-styles">
                                        <SelectValue placeholder="Select belt rank" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {BELT_RANKS.map((rank) => (
                                            <SelectItem key={rank} value={rank}>
                                                {rank.charAt(0).toUpperCase() + rank.slice(1)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Contact Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    defaultValue={getFormData("email")}
                                    className="input-custom-styles"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="cellPhone">Cell Phone</Label>
                                <Input
                                    id="cellPhone"
                                    name="cellPhone"
                                    type="tel"
                                    defaultValue={getFormData("cellPhone")}
                                    className="input-custom-styles"
                                />
                            </div>
                        </div>

                        {/* Medical Information */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold">Medical Information</h3>
                            
                            <div className="space-y-2">
                                <Label htmlFor="specialNeeds">Special Needs</Label>
                                <Textarea
                                    id="specialNeeds"
                                    name="specialNeeds"
                                    defaultValue={getFormData("specialNeeds")}
                                    rows={3}
                                    className="input-custom-styles"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="allergies">Allergies</Label>
                                <Textarea
                                    id="allergies"
                                    name="allergies"
                                    defaultValue={getFormData("allergies")}
                                    rows={3}
                                    className="input-custom-styles"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="medications">Medications</Label>
                                <Textarea
                                    id="medications"
                                    name="medications"
                                    defaultValue={getFormData("medications")}
                                    rows={3}
                                    className="input-custom-styles"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="immunizationsUpToDate">Immunizations Up to Date</Label>
                                <Select name="immunizationsUpToDate" defaultValue={getFormData("immunizationsUpToDate")}>
                                    <SelectTrigger className="input-custom-styles">
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Yes">Yes</SelectItem>
                                        <SelectItem value="No">No</SelectItem>
                                        <SelectItem value="Unknown">Unknown</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="immunizationNotes">Immunization Notes</Label>
                                <Textarea
                                    id="immunizationNotes"
                                    name="immunizationNotes"
                                    defaultValue={getFormData("immunizationNotes")}
                                    rows={3}
                                    className="input-custom-styles"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end space-x-2 pt-4">
                            <Button type="button" variant="outline" asChild>
                                <Link to="/admin/students">Cancel</Link>
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Adding Student..." : "Add Student"}
                            </Button>
                        </div>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}