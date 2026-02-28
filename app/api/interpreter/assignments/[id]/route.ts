import { NextResponse } from "next/server";
import { requireInterpreterEligible } from "@/lib/authz";
import { getAssignmentForInterpreter } from "@/lib/assignments/interpreter";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: Params) {
  const profile = await requireInterpreterEligible(); // ✅ No leaks (APPROVED + ACTIVE only)
  const { id } = await ctx.params;

  const data = await getAssignmentForInterpreter(profile.id, id);
  if (!data) {
    // IMPORTANT: don’t reveal whether the assignment exists if it’s not visible
    return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(
    { ok: true, data },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
