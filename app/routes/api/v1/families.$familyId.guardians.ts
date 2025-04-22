import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import invariant from "tiny-invariant";
import {
    getGuardiansByFamily,
    createGuardian
} from "~/services/guardian.server";
import { requireApiAuth } from "~/utils/api-auth.server"; // Import auth helper
import type { TablesInsert } from "~/types/database.types"; // Import TablesInsert

/**
 * API endpoint loader to fetch all guardians for a specific family.
 * Requires Bearer token authentication. User must be admin or belong to the family.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
    let user;
    try {
        user = await requireApiAuth(request); // Authenticate
    } catch (error) {
        if (error instanceof Response) return error;
        console.error("[API Family Guardians Loader] Unexpected auth error:", error);
        return json({ error: "Authentication failed" }, { status: 500 });
    }

    invariant(params.familyId, "Family ID is required in URL path.");
    const familyId = params.familyId;

    try {
        // Service function includes authorization check
        const guardians = await getGuardiansByFamily(familyId, user.id);
        return json(guardians, { status: 200 });
    } catch (error) {
        if (error instanceof Response) {
            // Service function throws Response objects for known errors (403, 500)
            console.warn(`[API Family Guardians Loader] Service threw Response (${error.status}) for family ${familyId}: ${await error.text()}`);
            return error; // Forward the Response
        }
        console.error(`[API Family Guardians Loader] Unexpected error fetching guardians for family ${familyId}:`, error);
        const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
        return json({ error: errorMessage }, { status: 500 });
    }
}

/**
 * API endpoint action to create a new guardian for a specific family.
 * Requires Bearer token authentication. User must be admin or belong to the family.
 */
export async function action({ request, params }: ActionFunctionArgs) {
    let user;
    try {
        user = await requireApiAuth(request); // Authenticate
    } catch (error) {
        if (error instanceof Response) return error;
        console.error("[API Family Guardians Action] Unexpected auth error:", error);
        return json({ error: "Authentication failed" }, { status: 500 });
    }

    invariant(params.familyId, "Family ID is required in URL path.");
    const familyId = params.familyId;

    // --- Handle POST Request (Create) ---
    if (request.method === "POST") {
        console.log(`[API Family Guardians Action] Received POST request for family ${familyId} by user ${user.id}`);
        let guardianData: Omit<TablesInsert<'guardians'>, 'family_id' | 'id' | 'created_at' | 'updated_at'>;
        try {
            guardianData = await request.json();
            // Add validation here (e.g., using Zod) to ensure required fields are present
            if (!guardianData.first_name || !guardianData.last_name || !guardianData.relationship || !guardianData.home_phone || !guardianData.cell_phone || !guardianData.email) {
                 throw new Error("Missing required guardian fields (first_name, last_name, relationship, home_phone, cell_phone, email).");
            }
        } catch (error) {
            console.warn(`[API Family Guardians Action] Invalid JSON body for POST request:`, error);
            const message = error instanceof Error ? error.message : "Invalid JSON body";
            return json({ error: message }, { status: 400 });
        }

        try {
            // Service function includes authorization check
            const newGuardian = await createGuardian(familyId, guardianData, user.id);
            console.log(`[API Family Guardians Action] Successfully created guardian ${newGuardian.id} for family ${familyId}`);
            return json(newGuardian, { status: 201 }); // 201 Created
        } catch (error) {
            if (error instanceof Response) {
                // Service function throws Response objects for known errors (403, 409, 500)
                console.warn(`[API Family Guardians Action] Service threw Response (${error.status}) for family ${familyId}: ${await error.text()}`);
                return error; // Forward the Response
            }
            console.error(`[API Family Guardians Action] Unexpected error creating guardian for family ${familyId}:`, error);
            const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
            return json({ error: errorMessage }, { status: 500 });
        }
    }

    // --- Method Not Allowed ---
    console.warn(`[API Family Guardians Action] Method Not Allowed: ${request.method}`);
    return json({ error: "Method Not Allowed" }, { status: 405, headers: { Allow: "GET, POST" } });
}
