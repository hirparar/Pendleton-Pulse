// app/api/admin/assignments/[id]/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { getAssignmentAdmin, updateAssignmentDetails } from "@/lib/assignments/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, ctx: Params) {
  await requireAdmin();
  const { id } = await ctx.params;
  const data = await getAssignmentAdmin(id);
  if (!data) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: Request, ctx: Params) {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const updated = await updateAssignmentDetails(admin, id, body);
    return NextResponse.json({ ok: true, data: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed" }, { status: 400 });
  }
}