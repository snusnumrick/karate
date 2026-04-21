import { describe, expect, it } from "vitest";
import {
  getDefaultPostLoginRedirect,
  resolvePostLoginRedirect,
} from "../post-login-redirect";

describe("post-login redirect helpers", () => {
  it("returns the expected default destination for each role", () => {
    expect(getDefaultPostLoginRedirect("admin")).toBe("/admin");
    expect(getDefaultPostLoginRedirect("instructor")).toBe("/instructor");
    expect(getDefaultPostLoginRedirect("user")).toBe("/family");
    expect(getDefaultPostLoginRedirect(null)).toBe("/family");
  });

  it("keeps safe internal redirect targets", () => {
    expect(resolvePostLoginRedirect("/events/abc/register", "user")).toBe("/events/abc/register");
  });

  it("falls back to the role default for invalid redirect targets", () => {
    expect(resolvePostLoginRedirect("https://evil.test", "admin")).toBe("/admin");
    expect(resolvePostLoginRedirect("//evil.test", "instructor")).toBe("/instructor");
  });
});
