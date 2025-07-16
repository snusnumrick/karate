import {type ActionFunctionArgs, json, type LoaderFunctionArgs, redirect} from "@remix-run/node";
import {Form, Link, useActionData, useLoaderData, useNavigation} from "@remix-run/react";
import {getSupabaseServerClient} from "~/utils/supabase.server";

import {Button} from "~/components/ui/button";
import {Input} from "~/components/ui/input";
import {Label} from "~/components/ui/label";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue,} from "~/components/ui/select";
import {Textarea} from "~/components/ui/textarea";
import {Alert, AlertDescription, AlertTitle} from "~/components/ui/alert";

// Loader to get family ID and name for context
export async function loader({request}: LoaderFunctionArgs) {
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        // Should be protected by layout, but handle just in case
        return redirect("/login", {headers});
    }

    // Get the user's profile to find their family_id
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profileData || !profileData.family_id) {
        console.error("Error fetching profile or family_id for add student:", profileError?.message);
        // Redirect to family page with an error state? Or throw?
        // For now, throw an error that the ErrorBoundary can catch.
        throw new Response("Could not find your family information. Please go back to the family portal.", {status: 404});
    }

    // Fetch family name for display purposes (optional but nice)
    const {data: familyData, error: familyError} = await supabaseServer
        .from('families')
        .select('name')
        .eq('id', profileData.family_id)
        .single();

    if (familyError) {
        console.error("Error fetching family name:", familyError?.message);
        // Non-critical error, proceed without family name if needed
    }

    return json({familyId: profileData.family_id, familyName: familyData?.name || 'Your Family'}, {headers});
}


// Action function to handle adding the student
export async function action({request}: ActionFunctionArgs) {
    const formData = await request.formData();
    const {supabaseServer, response: {headers}} = getSupabaseServerClient(request);
    const {data: {user}} = await supabaseServer.auth.getUser();

    if (!user) {
        return json({error: "User not authenticated."}, {status: 401, headers});
    }

    // Get family_id from profile again (or pass from loader if preferred, but safer to re-fetch)
    const {data: profileData, error: profileError} = await supabaseServer
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profileData || !profileData.family_id) {
        console.error("Action Error: fetching profile or family_id:", profileError?.message);
        return json({error: "Could not find your family information."}, {status: 400, headers});
    }

    const familyId = profileData.family_id;

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
    // const beltRank = formData.get("beltRank") as string | null; // Removed - belt rank managed via belt_awards
    const email = formData.get("email") as string | null;
    const cellPhone = formData.get("cellPhone") as string | null;


    // Basic validation (add more as needed)
    if (!firstName || !lastName || !birthDate || !gender || !tShirtSize || !school || !gradeLevel) {
        return json({error: "Please fill in all required fields."}, {status: 400, headers});
    }

    try {
        const {error: studentInsertError} = await supabaseServer.from('students').insert({
            family_id: familyId,
            first_name: firstName,
            last_name: lastName,
            gender: gender,
            birth_date: birthDate,
            t_shirt_size: tShirtSize,
            school: school,
            grade_level: gradeLevel,
            special_needs: specialNeeds,
            allergies: allergies,
            medications: medications,
            immunizations_up_to_date: immunizationsUpToDate,
            immunization_notes: immunizationNotes,
            // belt_rank: beltRank as typeof BELT_RANKS[number] | null, // Removed - belt rank managed via belt_awards
            email: email,
            cell_phone: cellPhone,
            // Add other fields as necessary, ensure they match your DB schema
            // Note: Initial belt rank (White) should be added via belt_awards by an admin if needed.
        }).select().single();

        if (studentInsertError) {
            console.error("Error inserting student:", studentInsertError);
            throw studentInsertError;
        }



        // Redirect back to the family portal on success
        return redirect("/family", {headers});

    } catch (error: unknown) {
        console.error('Add student error:', error);
        return json({
            error: error instanceof Error ? error.message : 'Failed to add student. Please try again.',
            // Optionally return formData values to repopulate form
            // formData: Object.fromEntries(formData)
        }, {status: 500, headers});
    }
}

export default function AddStudentPage() {
    const {familyName} = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    // State for family name (if needed for pre-filling last name)
    // const [studentLastName, setStudentLastName] = useState(familyName.split(' ').pop() || ''); // Basic attempt to get last name

    return (
        <div className="container mx-auto px-4 py-8">
            <Link to="/family" className="text-blue-600 hover:underline mb-6 inline-block">&larr; Back to Family
                Portal</Link>

            <h1 className="text-3xl font-bold mb-2">Add Student to {familyName}</h1>
            <p className="text-muted-foreground mb-6">Enter the details for the new student.</p>

            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md border dark:border-gray-700">
                <Form method="post" className="space-y-6">
                    {/* Hidden input for familyId might not be needed if fetched in action */}
                    {/* <input type="hidden" name="familyId" value={familyId} /> */}

                    <h2 className="text-xl font-semibold text-foreground mb-4 pb-2 border-b border-border dark:border-gray-700">Student
                        Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Required Fields */}
                        <div>
                            <Label htmlFor="firstName" className="block text-sm font-medium mb-1">
                                First Name<span className="text-red-500">*</span>
                            </Label>
                            <Input type="text" id="firstName" name="firstName" required
                                   autoComplete="given-name"
                                   className="input-custom-styles focus:ring-green-500" tabIndex={1}/>
                        </div>
                        <div>
                            <Label htmlFor="lastName" className="block text-sm font-medium mb-1">
                                Last Name<span className="text-red-500">*</span>
                            </Label>
                            <Input type="text" id="lastName" name="lastName" required
                                   autoComplete="family-name"
                                   className="input-custom-styles focus:ring-green-500" tabIndex={2} /* defaultValue={studentLastName} */ />
                        </div>
                        <div>
                            <Label htmlFor="birthDate" className="block text-sm font-medium mb-1">
                                Birth Date<span className="text-red-500">*</span>
                            </Label>
                            <Input type="date" id="birthDate" name="birthDate" required
                                   className="input-custom-styles focus:ring-green-500 dark:[color-scheme:dark]" tabIndex={3}/>
                        </div>
                        <div>
                            <Label htmlFor="gender" className="block text-sm font-medium mb-1">
                                Gender<span className="text-red-500">*</span>
                            </Label>
                            <Select name="gender" required>
                                <SelectTrigger id="gender"
                                               className="input-custom-styles w-full" tabIndex={4}> {/* Applied custom style, removed redundant */}
                                    <SelectValue placeholder="Select gender"/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Male">Male</SelectItem>
                                    <SelectItem value="Female">Female</SelectItem>
                                    <SelectItem value="Other">Other</SelectItem>
                                    <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="tShirtSize" className="block text-sm font-medium mb-1">
                                T-Shirt Size<span className="text-red-500">*</span>
                            </Label>
                            <Select name="tShirtSize" required>
                                <SelectTrigger id="tShirtSize"
                                               className="input-custom-styles w-full" tabIndex={5}> {/* Applied custom style, removed redundant */}
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
                        </div>
                        <div>
                            <Label htmlFor="school" className="block text-sm font-medium mb-1">
                                School<span className="text-red-500">*</span>
                            </Label>
                            <Input type="text" id="school" name="school" required className="input-custom-styles focus:ring-green-500" tabIndex={6}/>
                        </div>
                        <div>
                            <Label htmlFor="gradeLevel" className="block text-sm font-medium mb-1">
                                Grade Level<span className="text-red-500">*</span>
                            </Label>
                            <Select name="gradeLevel" required>
                                <SelectTrigger id="gradeLevel"
                                               className="input-custom-styles w-full" tabIndex={7}> {/* Applied custom style, removed redundant */}
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
                        </div>
                        {/* Belt Rank Select Removed - Managed via belt_awards table */}
                    </div>

                    <h2 className="text-xl font-semibold text-foreground mt-8 mb-4 pb-2 border-b border-border dark:border-gray-700">Optional
                        Information</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <Label htmlFor="email" className="block text-sm font-medium mb-1">
                                Student Email
                            </Label>
                            <Input type="email" id="email" name="email" autoComplete="email" className="input-custom-styles focus:ring-green-500" tabIndex={8}/>
                        </div>
                        <div>
                            <Label htmlFor="cellPhone" className="block text-sm font-medium mb-1">
                                Student Cell #
                            </Label>
                            <Input type="tel" id="cellPhone" name="cellPhone" autoComplete="mobile tel" className="input-custom-styles focus:ring-green-500" tabIndex={9}/>
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="specialNeeds" className="block text-sm font-medium mb-1">
                                Special Needs (Leave blank if NONE)
                            </Label>
                            <Input type="text" id="specialNeeds" name="specialNeeds" className="input-custom-styles focus:ring-green-500" tabIndex={10}/>
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="allergies" className="block text-sm font-medium mb-1">
                                Allergies (Leave blank if NONE)
                            </Label>
                            <Textarea id="allergies" name="allergies" rows={3} className="input-custom-styles focus:ring-green-500" tabIndex={11}/>
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="medications" className="block text-sm font-medium mb-1">
                                Medications (Leave blank if NONE)
                            </Label>
                            <Textarea id="medications" name="medications" rows={3} className="input-custom-styles focus:ring-green-500" tabIndex={12}/>
                        </div>
                        <div>
                            <Label htmlFor="immunizationsUpToDate" className="block text-sm font-medium mb-1">
                                Immunizations Up To Date?
                            </Label>
                            <Select name="immunizationsUpToDate">
                                <SelectTrigger id="immunizationsUpToDate"
                                               className="input-custom-styles w-full" tabIndex={13}> {/* Applied custom style, removed redundant */}
                                    <SelectValue placeholder="Select option"/>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Yes">Yes</SelectItem>
                                    <SelectItem value="No">No</SelectItem>
                                    <SelectItem value="Unknown">Unknown</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="md:col-span-2">
                            <Label htmlFor="immunizationNotes" className="block text-sm font-medium mb-1">
                                Immunization Notes
                            </Label>
                            <Textarea id="immunizationNotes" name="immunizationNotes" rows={3}
                                      className="input-custom-styles focus:ring-green-500" tabIndex={14}/>
                        </div>
                    </div>

                    {actionData?.error && (
                        <Alert variant="destructive" className="mt-4">
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{actionData.error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="flex justify-end mt-8">
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="font-bold py-3 px-6 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                            tabIndex={15}
                        >
                            {isSubmitting ? "Adding Student..." : "Add Student"}
                        </Button>
                    </div>
                </Form>
            </div>
        </div>
    );
}

// Optional: Add an ErrorBoundary specific to this page
export function ErrorBoundary() {
    // You can customize this based on the ErrorBoundary in _layout.register.tsx
    // For now, a simple one:
    return (
        <div className="container mx-auto px-4 py-8">
            <Link to="/family" className="text-blue-600 hover:underline mb-6 inline-block">&larr; Back to Family
                Portal</Link>
            <Alert variant="destructive">
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                    There was an error loading or processing the add student form. Please try again or go back to the
                    family portal.
                </AlertDescription>
            </Alert>
        </div>
    );
}
