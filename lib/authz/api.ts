import { ensureUserProfile } from "@/lib/ensure-profile";
import { AuthzError } from "@/lib/authz/errors";

export async function requireProfileApi() {
  const profile = await ensureUserProfile();
  if (!profile) throw new AuthzError("UNAUTHENTICATED", "Not signed in", 401);
  return profile;
}

export async function requireAdminApi() {
  const profile = await requireProfileApi();
  if (profile.role !== "ADMIN") throw new AuthzError("FORBIDDEN", "Admin only", 403);
  return profile;
}

export async function requireInterpreterApi() {
  const profile = await requireProfileApi();
  if (profile.role !== "INTERPRETER") throw new AuthzError("FORBIDDEN", "Interpreter only", 403);
  return profile;
}

export async function requireInterpreterEligibleApi() {
  const profile = await requireInterpreterApi();

  // fail closed
  if (profile.isActive === false) throw new AuthzError("INACTIVE", "Account inactive", 403);

  if (profile.status === "PENDING") throw new AuthzError("PENDING", "Approval pending", 403);
  if (profile.status === "DENIED") throw new AuthzError("DENIED", "Access denied", 403);
  if (profile.status !== "APPROVED") throw new AuthzError("UNKNOWN_STATUS", "Unknown status", 403);

  return profile;
}
