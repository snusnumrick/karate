import { json, redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { csrf } from "~/utils/csrf.server";
import { requireAdminUser } from "~/utils/auth.server";
import { getClassSessionById, updateClassSession } from "~/services/class.server";

const ACTION_STATUS_MAP = {
  complete: "completed",
  cancel: "cancelled",
} as const satisfies Record<string, "completed" | "cancelled">;

export async function action({ request, params }: ActionFunctionArgs) {
  await requireAdminUser(request);
  await csrf.validate(request);

  const classId = params.id;
  const sessionId = params.sessionId;
  const actionKey = params.action as keyof typeof ACTION_STATUS_MAP | undefined;

  if (!classId || !sessionId || !actionKey) {
    throw new Response("Missing parameters", { status: 400 });
  }

  const targetStatus = ACTION_STATUS_MAP[actionKey];
  if (!targetStatus) {
    throw new Response("Unsupported session action", { status: 400 });
  }

  const session = await getClassSessionById(sessionId);
  if (!session) {
    throw new Response("Session not found", { status: 404 });
  }

  if (session.class_id !== classId) {
    throw new Response("Session does not belong to the specified class", { status: 400 });
  }

  const updatedSession = await updateClassSession(sessionId, { status: targetStatus });

  const acceptsJson = request.headers.get("accept")?.includes("application/json");
  if (acceptsJson) {
    return json({ success: true, status: updatedSession.status });
  }

  return redirect(`/admin/classes/${classId}/sessions`);
}

export function loader({ request }: LoaderFunctionArgs) {
  if (request.method === "GET") {
    throw new Response("Method Not Allowed", { status: 405 });
  }

  throw new Response("Unsupported method", { status: 405 });
}
