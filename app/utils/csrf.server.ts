import { CSRF } from "remix-utils/csrf/server";
import { createCookie } from "@remix-run/node";

// Create cookie for CSRF tokens
const csrfCookie = createCookie("__csrf", {
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  secrets: [process.env.SESSION_SECRET || "default-secret"],
  secure: process.env.NODE_ENV === "production",
});

// Create CSRF instance
export const csrf = new CSRF({
  cookie: csrfCookie,
});

// Helper function to validate CSRF token in actions
export async function validateCSRF(request: Request) {
  try {
    await csrf.validate(request);
  } catch {
    throw new Response("Invalid CSRF token", { status: 403 });
  }
}

// Helper function to get CSRF token for forms
export async function getCSRFToken(request: Request) {
  const [token] = await csrf.commitToken(request);
  return token;
}