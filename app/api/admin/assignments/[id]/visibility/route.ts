// app/api/admin/assignments/[id]/visibility/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { setAssignmentVisibility } from "@/lib/assignments/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Params) {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const mode = String(body?.mode ?? "").trim() as "ALL" | "RESTRICTED";
    if (!["ALL", "RESTRICTED"].includes(mode))
      return NextResponse.json({ ok: false, error: "Invalid mode" }, { status: 400 });

    await setAssignmentVisibility(admin, id, mode, body?.allowedIds ?? [], body?.note);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed" }, { status: 400 });
  }
}