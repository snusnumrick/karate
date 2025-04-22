import {type ActionFunctionArgs, json, type LoaderFunctionArgs, type MetaFunction, redirect} from "@remix-run/node";
import {Form, Link, useActionData, useLoaderData, useNavigation, useParams} from "@remix-run/react";
import {createClient} from "@supabase/supabase-js";
import {Database} from "~/types/database.types";
import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input";
import {Label} from "~/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "~/components/ui/select";
import {Textarea} from "~/components/ui/textarea";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";
import {BELT_RANKS} from "~/utils/constants"; // Assuming this constant file exists
import invariant from "tiny-invariant";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "~/components/ui/card";
import {ExclamationTriangleIcon} from "@radix-ui/react-icons";


// Loader to get family ID and name for context
export async function loader({params}: LoaderFunctionArgs) {
    invariant(params.familyId, "Missing familyId parameter");
    const familyId = params.familyId;

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("[Admin Add Student Loader] Missing Supabase URL or Service Role Key env vars.");
        throw new Response("Server configuration error", {status: 500});
    }

    const supabaseServer = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Fetch family name for display purposes
    const {data: familyData, error: familyError} = await supabaseServer
        .from('families')
        .select('name')
        .eq('id', familyId)
        .single();

    if (familyError) {
        console.error(`[Admin Add Student Loader] Error fetching family name for ${familyId}:`, familyError.message);
        // Non-critical error, proceed without family name if needed
        // Could throw 404 if family must exist
        if (familyError.code === 'PGRST116') { // code for "Not found"
            throw new Response(`Family with ID ${familyId} not found.`, {status: 404});
        }
    }

    // Pass familyId along with name
    return json({familyId: familyId, familyName: familyData?.name ?? 'Selected Family'});
}

export const meta: MetaFunction<typeof loader> = ({data}) => {
    const familyName = data?.familyName ?? "Family";
    return [
        {title: `Add Student to ${familyName} | Admin Dashboard`},
        {name: "description", content: `Add a new student to the ${familyName} family.`},
    ];
};


// Action function to handle adding the student
export async function action({request, params}: ActionFunctionArgs) {
    invariant(params.familyId, "Missing familyId parameter");
    const familyId = params.familyId; // Get familyId from URL params
    const formData = await request.formData();

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("[Admin Add Student Action] Missing Supabase URL or Service Role Key env vars.");
        return json({error: "Server configuration error"}, {status: 500});
    }

    const supabaseServer = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Extract student data from form
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const birthDate = formData.get("birthDate") as string;
    const gender = formData.get("gender") as string;
    const tShirtSize = formData.get("tShirtSize") as string;
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


    // Basic validation (add more as needed, consider Zod)
    const fieldErrors: Record<string, string> = {};
    if (!firstName) fieldErrors.firstName = "First name is required.";
    if (!lastName) fieldErrors.lastName = "Last name is required.";
    if (!birthDate) fieldErrors.birthDate = "Birth date is required.";
    if (!gender) fieldErrors.gender = "Gender is required.";
    if (!tShirtSize) fieldErrors.tShirtSize = "T-Shirt size is required.";
    if (!school) fieldErrors.school = "School is required.";
    if (!gradeLevel) fieldErrors.gradeLevel = "Grade level is required.";

    if (Object.keys(fieldErrors).length > 0) {
        // Return form data to repopulate fields on error
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
            family_id: familyId, // Use familyId from URL params
            first_name: firstName,
            last_name: lastName,
            gender: gender,
            birth_date: birthDate,
            t_shirt_size: tShirtSize,
            school: school,
            grade_level: gradeLevel,
            special_needs: specialNeeds || null,
            allergies: allergies || null,
            medications: medications || null,
            immunizations_up_to_date: immunizationsUpToDate || null,
            immunization_notes: immunizationNotes || null,
            belt_rank: beltRank as typeof BELT_RANKS[number] | null, // Cast belt rank
            email: email || null,
            cell_phone: cellPhone || null,
            // Add other fields as necessary, ensure they match your DB schema
        }).select().single(); // Select the newly created student

        if (studentInsertError) {
            console.error("[Admin Add Student Action] Error inserting student:", studentInsertError);
            // Check for specific errors like duplicates if needed
            throw studentInsertError;
        }

        console.log(`[Admin Add Student Action] Successfully added student ${newStudent?.id} to family ${familyId}`);
        // Redirect back to the admin family detail page on success
        return redirect(`/admin/families/${familyId}`);

    } catch (error: unknown) {
        console.error('[Admin Add Student Action] Add student error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to add student. Please try again.';
        // Check if it's a Supabase error for more details
        if (typeof error === 'object' && error !== null && 'code' in error) {
            // Potentially handle specific DB error codes (e.g., unique constraint violation)
            console.error('[Admin Add Student Action] Supabase error code:', (error as { code?: string }).code);
        }
        return json<{ error: string; fieldErrors: typeof fieldErrors; formData: Record<string, string> }>({
            error: errorMessage,
            fieldErrors, // Return field errors if they existed before the try block
            formData: Object.fromEntries(Array.from(formData.entries()).map(([key, value]) => [key, typeof value === 'string' ? value : ''])) // Return form data
        }, {status: 500});
    }
}

export default function AdminAddStudentPage() {
    const {familyName} = useLoaderData<typeof loader>();
    const actionData = useActionData<{
        error: string;
        fieldErrors: Record<string, string>;
        formData: Record<string, string>;
    }>();
    const navigation = useNavigation();
    const params = useParams(); // Use params to get familyId for the cancel link
    const isSubmitting = navigation.state === "submitting";

    // Helper to get default value from actionData if available
    const getFormData: (key: string) => string = (key: string) => (actionData && 'formData' in actionData ? (actionData.formData as Record<string, string>)[key] : '');
    const getFieldError: (key: string) => string | undefined = (key: string) => actionData?.fieldErrors?.[key];
    //const getFieldErrorsNumber: () => number = () => actionData?.fieldErrors ? Object.keys(actionData.fieldErrors).length : 0;


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Add Student to {familyName}</h1>
                <Button asChild variant="outline" size="sm">
                    <Link to={`/admin/families/${params.familyId}`}>Cancel</Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>New Student Details</CardTitle>
                    <CardDescription>Enter the information for the new student.</CardDescription>
                </CardHeader>
                <CardContent>
                    {actionData?.error && !actionData.fieldErrors && (
                        <Alert variant="destructive" className="mb-4">
                            <ExclamationTriangleIcon className="h-4 w-4"/>
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{actionData.error}</AlertDescription>
                        </Alert>
                    )}
                    <Form method="post" className="space-y-6">
                        {/* Hidden input for familyId might not be needed as it's in the action's params */}
                        {/* <input type="hidden" name="familyId" value={familyId} /> */}

                        <h3 className="text-lg font-semibold text-foreground mb-4 pb-2 border-b">Required
                            Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* First Name */}
                            <div className="space-y-1">
                                <Label htmlFor="firstName">First Name<span className="text-destructive">*</span></Label>
                                <Input type="text" id="firstName" name="firstName" required
                                       defaultValue={getFormData('firstName')}
                                       aria-invalid={!!getFieldError('firstName')} aria-describedby="firstName-error"/>
                                {getFieldError('firstName') && <p id="firstName-error"
                                                                  className="text-sm text-destructive">{getFieldError('firstName')}</p>}
                            </div>
                            {/* Last Name */}
                            <div className="space-y-1">
                                <Label htmlFor="lastName">Last Name<span className="text-destructive">*</span></Label>
                                <Input type="text" id="lastName" name="lastName" required
                                       defaultValue={getFormData('lastName')} aria-invalid={!!getFieldError('lastName')}
                                       aria-describedby="lastName-error"/>
                                {getFieldError('lastName') && <p id="lastName-error"
                                                                 className="text-sm text-destructive">{getFieldError('lastName')}</p>}
                            </div>
                            {/* Birth Date */}
                            <div className="space-y-1">
                                <Label htmlFor="birthDate">Birth Date<span className="text-destructive">*</span></Label>
                                <Input type="date" id="birthDate" name="birthDate" required
                                       defaultValue={getFormData('birthDate')}
                                       aria-invalid={!!getFieldError('birthDate')} aria-describedby="birthDate-error"
                                       className="dark:[color-scheme:dark]"/>
                                {getFieldError('birthDate') && <p id="birthDate-error"
                                                                  className="text-sm text-destructive">{getFieldError('birthDate')}</p>}
                            </div>
                            {/* Gender */}
                            <div className="space-y-1">
                                <Label htmlFor="gender">Gender<span className="text-destructive">*</span></Label>
                                <Select name="gender" required defaultValue={getFormData('gender')}>
                                    <SelectTrigger id="gender" aria-invalid={!!getFieldError('gender')}
                                                   aria-describedby="gender-error">
                                        <SelectValue placeholder="Select gender"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Male">Male</SelectItem>
                                        <SelectItem value="Female">Female</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                        <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                                    </SelectContent>
                                </Select>
                                {getFieldError('gender') && <p id="gender-error"
                                                               className="text-sm text-destructive">{getFieldError('gender')}</p>}
                            </div>
                            {/* T-Shirt Size */}
                            <div className="space-y-1">
                                <Label htmlFor="tShirtSize">T-Shirt Size<span
                                    className="text-destructive">*</span></Label>
                                <Select name="tShirtSize" required defaultValue={getFormData('tShirtSize')}>
                                    <SelectTrigger id="tShirtSize" aria-invalid={!!getFieldError('tShirtSize')}
                                                   aria-describedby="tShirtSize-error">
                                        <SelectValue placeholder="Select size"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="YXS">Youth XS</SelectItem>
                                        <SelectItem value="YS">Youth S</SelectItem>
                                        <SelectItem value="YM">Youth M</SelectItem>
                                        <SelectItem value="YL">Youth L</SelectItem>
                                        <SelectItem value="YXL">Youth XL</SelectItem>
                                        <SelectItem value="AS">Adult S</SelectItem>
                                        <SelectItem value="AM">Adult M</SelectItem>
                                        <SelectItem value="AL">Adult L</SelectItem>
                                        <SelectItem value="AXL">Adult XL</SelectItem>
                                        <SelectItem value="A2XL">Adult 2XL</SelectItem>
                                    </SelectContent>
                                </Select>
                                {getFieldError('tShirtSize') && <p id="tShirtSize-error"
                                                                   className="text-sm text-destructive">{getFieldError('tShirtSize')}</p>}
                            </div>
                            {/* School */}
                            <div className="space-y-1">
                                <Label htmlFor="school">School<span className="text-destructive">*</span></Label>
                                <Input type="text" id="school" name="school" required
                                       defaultValue={getFormData('school')} aria-invalid={!!getFieldError('school')}
                                       aria-describedby="school-error"/>
                                {getFieldError('school') && <p id="school-error"
                                                               className="text-sm text-destructive">{getFieldError('school')}</p>}
                            </div>
                            {/* Grade Level */}
                            <div className="space-y-1">
                                <Label htmlFor="gradeLevel">Grade Level<span
                                    className="text-destructive">*</span></Label>
                                <Select name="gradeLevel" required defaultValue={getFormData('gradeLevel')}>
                                    <SelectTrigger id="gradeLevel" aria-invalid={!!getFieldError('gradeLevel')}
                                                   aria-describedby="gradeLevel-error">
                                        <SelectValue placeholder="Select grade"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Pre-K">Pre-Kindergarten</SelectItem>
                                        <SelectItem value="K">Kindergarten</SelectItem>
                                        <SelectItem value="1">1st Grade</SelectItem>
                                        <SelectItem value="2">2nd Grade</SelectItem>
                                        <SelectItem value="3">3rd Grade</SelectItem>
                                        <SelectItem value="4">4th Grade</SelectItem>
                                        <SelectItem value="5">5th Grade</SelectItem>
                                        <SelectItem value="6">6th Grade</SelectItem>
                                        <SelectItem value="7">7th Grade</SelectItem>
                                        <SelectItem value="8">8th Grade</SelectItem>
                                        <SelectItem value="9">9th Grade</SelectItem>
                                        <SelectItem value="10">10th Grade</SelectItem>
                                        <SelectItem value="11">11th Grade</SelectItem>
                                        <SelectItem value="12">12th Grade</SelectItem>
                                        <SelectItem value="Post-Secondary">Post-Secondary</SelectItem>
                                        <SelectItem value="N/A">Not Applicable</SelectItem>
                                    </SelectContent>
                                </Select>
                                {getFieldError('gradeLevel') && <p id="gradeLevel-error"
                                                                   className="text-sm text-destructive">{getFieldError('gradeLevel')}</p>}
                            </div>
                        </div>

                        <h3 className="text-lg font-semibold text-foreground mt-6 mb-4 pb-2 border-b">Optional
                            Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Belt Rank */}
                            <div className="space-y-1">
                                <Label htmlFor="beltRank">Starting Belt Rank</Label>
                                <Select name="beltRank" defaultValue={getFormData('beltRank')}>
                                    <SelectTrigger id="beltRank">
                                        <SelectValue placeholder="Select belt rank (usually White)"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {BELT_RANKS.map((rank) => (
                                            <SelectItem key={rank} value={rank} className="capitalize">
                                                {rank}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Student Email */}
                            <div className="space-y-1">
                                <Label htmlFor="email">Student Email</Label>
                                <Input type="email" id="email" name="email" defaultValue={getFormData('email')}/>
                            </div>
                            {/* Student Cell Phone */}
                            <div className="space-y-1">
                                <Label htmlFor="cellPhone">Student Cell #</Label>
                                <Input type="tel" id="cellPhone" name="cellPhone"
                                       defaultValue={getFormData('cellPhone')}/>
                            </div>
                            {/* Special Needs */}
                            <div className="space-y-1 md:col-span-2">
                                <Label htmlFor="specialNeeds">Special Needs (Leave blank if NONE)</Label>
                                <Input type="text" id="specialNeeds" name="specialNeeds"
                                       defaultValue={getFormData('specialNeeds')}/>
                            </div>
                            {/* Allergies */}
                            <div className="space-y-1 md:col-span-2">
                                <Label htmlFor="allergies">Allergies (Leave blank if NONE)</Label>
                                <Textarea id="allergies" name="allergies" rows={3}
                                          defaultValue={getFormData('allergies')}/>
                            </div>
                            {/* Medications */}
                            <div className="space-y-1 md:col-span-2">
                                <Label htmlFor="medications">Medications (Leave blank if NONE)</Label>
                                <Textarea id="medications" name="medications" rows={3}
                                          defaultValue={getFormData('medications')}/>
                            </div>
                            {/* Immunizations Up To Date */}
                            <div className="space-y-1">
                                <Label htmlFor="immunizationsUpToDate">Immunizations Up To Date?</Label>
                                <Select name="immunizationsUpToDate"
                                        defaultValue={getFormData('immunizationsUpToDate')}>
                                    <SelectTrigger id="immunizationsUpToDate">
                                        <SelectValue placeholder="Select option"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Yes">Yes</SelectItem>
                                        <SelectItem value="No">No</SelectItem>
                                        <SelectItem value="Unknown">Unknown</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {/* Immunization Notes */}
                            <div className="space-y-1 md:col-span-2">
                                <Label htmlFor="immunizationNotes">Immunization Notes</Label>
                                <Textarea id="immunizationNotes" name="immunizationNotes" rows={3}
                                          defaultValue={getFormData('immunizationNotes')}/>
                            </div>
                        </div>

                        {/* Display general error if fieldErrors exist */}
                        {actionData?.error && actionData.fieldErrors && Object.keys(actionData.fieldErrors).length > 0 && (
                            <Alert variant="destructive" className="mt-4">
                                <ExclamationTriangleIcon className="h-4 w-4"/>
                                <AlertTitle>Validation Error</AlertTitle>
                                <AlertDescription>{actionData.error}</AlertDescription>
                            </Alert>
                        )}


                        <div className="flex justify-end mt-6">
                            <Button type="button" variant="outline" asChild className="mr-2">
                                <Link to={`/admin/families/${params.familyId}`}>Cancel</Link>
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-blue-600 text-white hover:bg-blue-700"
                            >
                                {isSubmitting ? "Adding Student..." : "Add Student"}
                            </Button>
                        </div>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}

// Re-use the Error Boundary from the main family detail page for now
// Or create a more specific one if needed
export {ErrorBoundary} from "./admin.families.$familyId";
