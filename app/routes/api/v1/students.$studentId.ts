import type { LoaderFunctionArgs } from "@remix-run/node";
// Response is globally available or comes from web fetch API, not @remix-run/node
import { json } from "@remix-run/node";
import invariant from "tiny-invariant";
import { getStudentDetails } from "~/services/student.server";
import { toServiceErrorResponseInit } from "~/utils/service-errors.server";
import { requireApiAuth, requireApiRole } from "~/utils/api-auth.server"; // Import auth helpers

/**
 * API endpoint to fetch details for a specific student.
 * Requires Bearer token authentication and 'admin' role.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
    // 1. Authenticate the request using JWT Bearer token
    let user;
    try {
        user = await requireApiAuth(request);
        // 2. Authorize: Ensure user has the required role (e.g., 'admin')
        // Adjust role check based on your application's needs
        await requireApiRole(user, 'admin');
    } catch (error) {
        // requireApiAuth and requireApiRole throw Response objects on failure
        if (error instanceof Response) {
            return error;
        }
        // Fallback for unexpected errors during auth
        console.error("[API Student Loader] Unexpected auth error:", error);
        return json({ error: "Authentication failed" }, { status: 500 });
    }

    // 3. Validate parameters
    invariant(params.studentId, "Student ID is required");
    const studentId = params.studentId;

    // 4. Fetch data using the service function
    try {
        const studentDetails = await getStudentDetails(studentId);
        // Return data on success
        return json(studentDetails, { status: 200 });

    } catch (error) {
        const { status, body } = toServiceErrorResponseInit(error);
        if (status !== 500) {
            console.warn(`[API Student Loader] Service error (${status}) for student ${studentId}: ${body.message}`);
        }
        console.error(`[API Student Loader] Unexpected error fetching student ${studentId}:`, error);
        return json({ error: body.message }, { status });
    }
}

// Optional: Add action function later for PUT/PATCH/DELETE if needed
// export async function action({ request, params }: ActionFunctionArgs) { ... }
