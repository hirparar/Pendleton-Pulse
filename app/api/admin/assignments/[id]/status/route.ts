// app/api/admin/assignments/[id]/status/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { setAssignmentStatus } from "@/lib/assignments/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Params) {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const updated = await setAssignmentStatus(admin, id, body.status, body.note);
    return NextResponse.json({ ok: true, data: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed" }, { status: 400 });
  }
}