// app/api/admin/assignments/[id]/interpreters/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { assignInterpreterToJob, removeInterpreterFromJob } from "@/lib/assignments/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** POST: assign an interpreter */
export async function POST(req: Request, ctx: Params) {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const interpreterProfileId = String(body?.interpreterProfileId ?? "").trim();
    if (!interpreterProfileId)
      return NextResponse.json({ ok: false, error: "interpreterProfileId is required" }, { status: 400 });

    const link = await assignInterpreterToJob(admin, id, interpreterProfileId, body?.note);
    return NextResponse.json({ ok: true, data: link });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed" }, { status: 400 });
  }
}

/** DELETE: remove an interpreter */
export async function DELETE(req: Request, ctx: Params) {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const interpreterProfileId = String(body?.interpreterProfileId ?? "").trim();
    if (!interpreterProfileId)
      return NextResponse.json({ ok: false, error: "interpreterProfileId is required" }, { status: 400 });

    const link = await removeInterpreterFromJob(admin, id, interpreterProfileId, body?.note);
    return NextResponse.json({ ok: true, data: link });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed" }, { status: 400 });
  }
}