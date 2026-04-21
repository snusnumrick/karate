import type { UserRole } from "~/types/auth";
import { safeRedirect } from "~/utils/redirect";

export function getDefaultPostLoginRedirect(role: UserRole | null | undefined): string {
  if (role === "admin") {
    return "/admin";
  }

  if (role === "instructor") {
    return "/instructor";
  }

  return "/family";
}

export function resolvePostLoginRedirect(
  target: FormDataEntryValue | string | null | undefined,
  role: UserRole | null | undefined
): string {
  return safeRedirect(target, getDefaultPostLoginRedirect(role));
}
