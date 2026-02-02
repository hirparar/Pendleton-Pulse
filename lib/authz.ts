import { redirect } from "next/navigation";
import { ensureUserProfile } from "@/lib/ensure-profile";

export async function requireProfile() {
  const profile = await ensureUserProfile();
  if (!profile) redirect("/sign-in");
  return profile;
}

export async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "ADMIN") redirect("/post-sign-in");
  return profile;
}

export async function requireInterpreter() {
  const profile = await requireProfile();
  if (profile.role === "ADMIN") redirect("/admin");
  return profile;
}

export async function requireInterpreterApproved() {
  const profile = await requireInterpreter();
  if (profile.status === "PENDING") redirect("/interpreter/pending");
  if (profile.status === "DENIED") redirect("/interpreter/denied");
  return profile;
}
