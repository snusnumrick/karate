import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import invariant from "tiny-invariant";
import { getSupabaseAdminClient } from "~/utils/supabase.server";

// Removed unused StudentInput type
// Removed unused Guardian2Input interface

// Define expanded request body structure
interface RegisterRequestBody {
    // User Auth
    email?: string;
    password?: string;
    marketingEmails?: boolean; // Added

    // Family Info
    familyName?: string;
    address?: string; // Added
    city?: string; // Added
    province?: string; // Added
    postalCode?: string; // Added
    primaryPhone?: string; // Renamed from guardianPhone for clarity
    referralSource?: string | null; // Added
    referralName?: string | null; // Added
    emergencyContact?: string | null; // Added
    healthInfo?: string | null; // Added (e.g., health number)

    // Guardian 1 Info
    guardian1FirstName?: string; // Renamed
    guardian1LastName?: string; // Renamed
    guardian1Relationship?: string; // Renamed
    guardian1HomePhone?: string; // Added
    guardian1WorkPhone?: string | null; // Added
    guardian1CellPhone?: string; // Added
    guardian1Employer?: string | null; // Added
    guardian1EmployerPhone?: string | null; // Added
    guardian1EmployerNotes?: string | null; // Added

    // Guardian 2 and Students removed from API registration request
    // guardian2?: Guardian2Input | null;
    // students?: StudentInput[];
}

// Define success response structure (excluding sensitive info)
interface RegisterSuccessResponse {
    userId: string;
    familyId: string;
    message: string;
}



/**
 * API endpoint for user registration.
 * Creates a Supabase user, a family, a guardian, and a profile record.
 * Requires email confirmation to be enabled in Supabase project settings.
 */
export async function action({ request }: ActionFunctionArgs) {
    if (request.method !== "POST") {
        return json({ error: "Method Not Allowed" }, { status: 405 });
    }

    let body: RegisterRequestBody;
    try {
        body = await request.json();
    } catch {
        return json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // --- Input Validation ---
    const {
        // Removed duplicate declarations
        // User Auth
        email,
        password,
        marketingEmails = false, // Default to false if not provided
        // Family
        familyName,
        address,
        city,
        province,
        postalCode,
        primaryPhone,
        referralSource,
        referralName,
        emergencyContact,
        healthInfo,
        // Guardian 1
        guardian1FirstName,
        guardian1LastName,
        guardian1Relationship = 'Parent/Guardian', // Default relationship
        guardian1HomePhone,
        guardian1WorkPhone,
        guardian1CellPhone,
        guardian1Employer,
        guardian1EmployerPhone,
        guardian1EmployerNotes,
        // guardian2 removed
        // students removed
    } = body;

    // --- Input Validation ---
    // Required fields check
    const requiredFields = {
        email, password, familyName, address, city, province, postalCode, primaryPhone,
        guardian1FirstName, guardian1LastName, guardian1Relationship, guardian1HomePhone, guardian1CellPhone
    };
    const missingFields = Object.entries(requiredFields)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missingFields.length > 0) {
        return json({ error: `Missing required fields: ${missingFields.join(', ')}` }, { status: 400 });
    }

    // Password length
    if (password && password.length < 8) { // Align with web form validation
        return json({ error: "Password must be at least 8 characters long" }, { status: 400 });
    }

    // Removed student validation

    // Add more robust validation (email format, phone format, etc.)

    const supabaseAdmin = getSupabaseAdminClient();
    let createdUserId: string | undefined;
    let createdFamilyId: string | undefined;

    try {
        // 1. Create Supabase User
        console.log(`[API Register] Attempting to create user for email: ${email}`);
        // Construct the redirect URL based on the request origin (needed for email confirmation link)
        // Note: This assumes the API is hosted on the same domain or can determine the frontend domain.
        // Adjust if API is hosted separately.
        // const url = new URL(request.url); // No longer needed
        // const emailRedirectTo = `${url.origin}/auth/callback`; // Removed unused variable

        const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.createUser({
            email: email!, // Use non-null assertion after validation
            password: password!, // Use non-null assertion after validation
            email_confirm: true, // Ensure email confirmation is required
            // phone: primaryPhone, // Optionally add primary phone if needed for auth
            user_metadata: {
                // Store marketing preference directly in user_metadata
                receive_marketing_emails: marketingEmails
            },
        });


        if (userError) {
            console.error(`[API Register] Error creating Supabase user for ${email}:`, userError.message);
            // Handle specific errors like "User already registered"
            if (userError.message.includes("already registered")) {
                return json({ error: "Email address is already registered." }, { status: 409 }); // 409 Conflict
            }
            return json({ error: `User creation failed: ${userError.message}` }, { status: 500 });
        }

        invariant(user, "User object should exist after successful creation");
        createdUserId = user.id;
        console.log(`[API Register] Successfully created Supabase user ${createdUserId} for email: ${email}`);

        // --- Database Operations ---
        // Note: These are sequential. Ideally, use a DB transaction (RPC function) for atomicity.

        // 2. Create Family Record
        console.log(`[API Register] Creating family record for: ${familyName}`);
        const { data: familyData, error: familyError } = await supabaseAdmin
            .from('families')
            .insert({
                name: familyName!, // Use non-null assertion after validation
                email: email!,
                primary_phone: primaryPhone!,
                address: address!,
                city: city!,
                province: province!,
                postal_code: postalCode!,
                referral_source: referralSource, // Already handles null
                referral_name: referralName, // Already handles null
                emergency_contact: emergencyContact, // Already handles null
                health_info: healthInfo, // Already handles null
                // notes: '', // Add if needed
            })
            .select('id')
            .single();

        if (familyError || !familyData) {
            console.error(`[API Register] Error creating family record for ${familyName}:`, familyError?.message);
            // Attempt to clean up the created Supabase user
            throw new Error(`Database error: Failed to create family record. ${familyError?.message || ''}`);
        }
        createdFamilyId = familyData.id;
        console.log(`[API Register] Successfully created family record ${createdFamilyId} for: ${familyName}`);

        // 3. Create Guardian 1 Record
        console.log(`[API Register] Creating guardian 1 record for: ${guardian1FirstName} ${guardian1LastName}, Family ID: ${createdFamilyId}`);
        const { error: guardian1Error } = await supabaseAdmin
            .from('guardians')
            .insert({
                family_id: createdFamilyId,
                first_name: guardian1FirstName!, // Use non-null assertion
                last_name: guardian1LastName!, // Use non-null assertion
                relationship: guardian1Relationship!, // Use non-null assertion
                email: email!, // Use user's email for guardian 1 email
                home_phone: guardian1HomePhone!, // Use non-null assertion
                cell_phone: guardian1CellPhone!, // Use non-null assertion
                work_phone: guardian1WorkPhone, // Already handles null
                employer: guardian1Employer, // Already handles null
                employer_phone: guardian1EmployerPhone, // Already handles null
                employer_notes: guardian1EmployerNotes, // Already handles null
            });

        if (guardian1Error) {
            console.error(`[API Register] Error creating guardian 1 record for ${guardian1FirstName} ${guardian1LastName}:`, guardian1Error.message);
            throw new Error(`Database error: Failed to create guardian 1 record. ${guardian1Error.message}`);
        }
        console.log(`[API Register] Successfully created guardian 1 record for: ${guardian1FirstName} ${guardian1LastName}`);

        // Removed Guardian 2 creation logic

        // 4. Create Profile Record (Link Supabase User to Family) - Step number updated
        console.log(`[API Register] Creating profile record for User ID: ${createdUserId}, Family ID: ${createdFamilyId}`);
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: createdUserId!, // Use non-null assertion
                family_id: createdFamilyId,
                email: email!, // Store email in profile as well
                role: 'user', // Default role
                // Marketing preference is now set in user_metadata during user creation
            });

        if (profileError) {
            console.error(`[API Register] Error creating profile record for user ${createdUserId}:`, profileError.message);
            // Attempt cleanup - Complex
            throw new Error(`Database error: Failed to create profile record. ${profileError.message}`);
        }
        console.log(`[API Register] Successfully created profile record for User ID: ${createdUserId!}`);

        // Removed Student creation logic

        // --- Success --- - Step number updated
        console.log(`[API Register] Registration successful for email: ${email!}`);
        const successResponse: RegisterSuccessResponse = {
            userId: createdUserId,
            familyId: createdFamilyId,
            message: "Registration successful. Please check your email to confirm your account.",
        };
        // Return 201 Created or 200 OK
        return json(successResponse, { status: 201 });

    } catch (error) {
        console.error(`[API Register] An error occurred during registration process for ${email}:`, error);

        // --- Attempt Cleanup on DB Error ---
        if (createdUserId) {
            console.warn(`[API Register] Attempting to delete Supabase user ${createdUserId} due to database error during registration.`);
            const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(createdUserId);
            if (deleteError) {
                console.error(`[API Register] CRITICAL: Failed to delete Supabase user ${createdUserId} after DB error:`, deleteError.message);
                // Log this critical state for manual intervention
            } else {
                console.log(`[API Register] Successfully deleted Supabase user ${createdUserId} after DB error.`);
            }
        }
        // --- End Cleanup ---

        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred during registration.";
        return json({ error: errorMessage }, { status: 500 });
    }
}

// Optional: Add a loader function that returns a 405 Method Not Allowed
// if someone tries to GET this route.
export async function loader() {
    return json({ error: "Method Not Allowed" }, { status: 405, headers: { Allow: "POST" } });
}
