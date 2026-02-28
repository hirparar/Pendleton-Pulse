// app/api/admin/assignments/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { createAssignment, listAssignmentsAdmin } from "@/lib/assignments/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  const data = await listAssignmentsAdmin();
  return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  try {
    const body = await req.json();
    const created = await createAssignment(admin, body);
    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Failed" }, { status: 400 });
  }
}