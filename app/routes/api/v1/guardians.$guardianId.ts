import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import invariant from "tiny-invariant";
import {
    getGuardianDetails,
    updateGuardian,
    deleteGuardian
} from "~/services/guardian.server";
import { requireApiAuth } from "~/utils/api-auth.server"; // Import auth helper
import type { TablesUpdate } from "~/types/database.types"; // Import TablesUpdate

/**
 * API endpoint loader to fetch details for a specific guardian.
 * Requires Bearer token authentication. User must be admin or belong to the guardian's family.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
    let user;
    try {
        user = await requireApiAuth(request); // Authenticate
    } catch (error) {
        if (error instanceof Response) return error;
        console.error("[API Guardian Loader] Unexpected auth error:", error);
        return json({ error: "Authentication failed" }, { status: 500 });
    }

    invariant(params.guardianId, "Guardian ID is required in URL path.");
    const guardianId = params.guardianId;

    try {
        // Service function includes authorization check
        const guardianDetails = await getGuardianDetails(guardianId, user.id);
        return json(guardianDetails, { status: 200 });
    } catch (error) {
        if (error instanceof Response) {
            // Service function throws Response objects for known errors (403, 404, 500)
            console.warn(`[API Guardian Loader] Service threw Response (${error.status}) for guardian ${guardianId}: ${await error.text()}`);
            return error; // Forward the Response
        }
        console.error(`[API Guardian Loader] Unexpected error fetching guardian ${guardianId}:`, error);
        const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
        return json({ error: errorMessage }, { status: 500 });
    }
}

/**
 * API endpoint action to update (PUT) or delete (DELETE) a specific guardian.
 * Requires Bearer token authentication. User must be admin or belong to the guardian's family.
 */
export async function action({ request, params }: ActionFunctionArgs) {
    let user;
    try {
        user = await requireApiAuth(request); // Authenticate
    } catch (error) {
        if (error instanceof Response) return error;
        console.error("[API Guardian Action] Unexpected auth error:", error);
        return json({ error: "Authentication failed" }, { status: 500 });
    }

    invariant(params.guardianId, "Guardian ID is required in URL path.");
    const guardianId = params.guardianId;

    try {
        // --- Handle DELETE Request ---
        if (request.method === "DELETE") {
            console.log(`[API Guardian Action] Received DELETE request for guardian ${guardianId} by user ${user.id}`);
            // Service function includes authorization check
            await deleteGuardian(guardianId, user.id);
            console.log(`[API Guardian Action] Successfully deleted guardian ${guardianId}`);
            return json({ message: "Guardian deleted successfully" }, { status: 200 }); // Or 204 No Content
        }

        // --- Handle PUT Request (Update) ---
        if (request.method === "PUT") {
            console.log(`[API Guardian Action] Received PUT request for guardian ${guardianId} by user ${user.id}`);
            let updateData: TablesUpdate<'guardians'>;
            try {
                updateData = await request.json();
                // Basic validation: ensure it's an object and not empty
                if (typeof updateData !== 'object' || updateData === null || Object.keys(updateData).length === 0) {
                    throw new Error("Invalid or empty JSON body provided for update.");
                }
                // Remove fields that shouldn't be updated directly via API if necessary
                delete updateData.id;
                delete updateData.family_id;
                // created_at and updated_at cannot be deleted reliably from TablesUpdate type

            } catch (error) {
                console.warn(`[API Guardian Action] Invalid JSON body for PUT request:`, error);
                return json({ error: "Invalid JSON body for update" }, { status: 400 });
            }

            // Service function includes authorization check
            const updatedGuardian = await updateGuardian(guardianId, updateData, user.id);
            console.log(`[API Guardian Action] Successfully updated guardian ${guardianId}`);
            return json(updatedGuardian, { status: 200 });
        }

        // --- Method Not Allowed ---
        console.warn(`[API Guardian Action] Method Not Allowed: ${request.method}`);
        return json({ error: "Method Not Allowed" }, { status: 405, headers: { Allow: "GET, PUT, DELETE" } });

    } catch (error) {
        if (error instanceof Response) {
            // Service function throws Response objects for known errors (403, 404, 500)
             console.warn(`[API Guardian Action] Service threw Response (${error.status}) for guardian ${guardianId}: ${await error.text()}`);
            return error; // Forward the Response
        }
        console.error(`[API Guardian Action] Unexpected error for guardian ${guardianId}:`, error);
        const errorMessage = error instanceof Error ? error.message : "An unknown server error occurred.";
        return json({ error: errorMessage }, { status: 500 });
    }
}
