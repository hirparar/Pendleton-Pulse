import { redirect } from "next/navigation";
import { ensureUserProfile } from "@/lib/ensure-profile";
import { AuthzError } from "@/lib/authz/errors";

function denyByRedirect(code: AuthzError["code"]): never {
  if (code === "UNAUTHENTICATED") redirect("/sign-in");
  if (code === "FORBIDDEN") redirect("/post-sign-in");

  if (code === "INACTIVE") redirect("/interpreter/inactive");
  if (code === "PENDING") redirect("/interpreter/pending");
  if (code === "DENIED") redirect("/interpreter/denied");

  redirect("/post-sign-in");
}

export async function requireProfile() {
  try {
    const profile = await ensureUserProfile();
    if (!profile) denyByRedirect("UNAUTHENTICATED");
    return profile;
  } catch {
    // Fail closed: if DB/profile fails, treat as unauthenticated for UI
    denyByRedirect("UNAUTHENTICATED");
  }
}

export async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "ADMIN") denyByRedirect("FORBIDDEN");
  return profile;
}

export async function requireInterpreter() {
  const profile = await requireProfile();
  if (profile.role === "ADMIN") redirect("/admin");
  return profile;
}

/**
 * Interpreters who are APPROVED + Active can access full interpreter app.
 * Everyone else is redirected to the appropriate gate.
 */
export async function requireInterpreterEligible() {
  const profile = await requireInterpreter();
  if (!profile) denyByRedirect("UNAUTHENTICATED");

  if (profile.isActive === false) denyByRedirect("INACTIVE");
  if (profile.status === "PENDING") denyByRedirect("PENDING");
  if (profile.status === "DENIED") denyByRedirect("DENIED");
  if (profile.status !== "APPROVED") denyByRedirect("FORBIDDEN");

  return profile;
}
