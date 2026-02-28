import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { requireProfile } from "@/lib/authz";

export async function GET() {
  noStore();

  const profile = await requireProfile();

  let dest = "/interpreter/pending";

  if (profile.role === "ADMIN") dest = "/admin";
  else if (profile.isActive === false) dest = "/interpreter/inactive";
  else if (profile.status === "APPROVED") dest = "/interpreter/dashboard";
  else if (profile.status === "PENDING") dest = "/interpreter/pending";
  else if (profile.status === "DENIED") dest = "/interpreter/denied";

  return NextResponse.json({ dest }, { headers: { "Cache-Control": "no-store" } });
}
