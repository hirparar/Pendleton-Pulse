import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/authz";

export default async function PostSignInPage() {
  const profile = await requireProfile();

  if (profile.role === "ADMIN") redirect("/admin");

  if (profile.status === "APPROVED") redirect("/interpreter/dashboard");
  if (profile.status === "PENDING") redirect("/interpreter/pending");
  if (profile.status === "DENIED") redirect("/interpreter/denied");

  redirect("/interpreter/pending");
}
