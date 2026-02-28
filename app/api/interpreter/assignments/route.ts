import { NextResponse } from "next/server";
import { requireInterpreterEligible } from "@/lib/authz";
import { listAssignmentsForInterpreter } from "@/lib/assignments/interpreter";

export const dynamic = "force-dynamic";

function parseStatusParams(url: URL) {
  const raw = url.searchParams.getAll("status").map((s) => s.trim().toUpperCase());
  const allowed = new Set(["OPEN", "ASSIGNED", "COMPLETED", "CANCELLED"]);

  const filtered = raw.filter((s) => allowed.has(s));
  return filtered.length ? (filtered as any) : undefined;
}

function parseDateParam(v: string | null) {
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

export async function GET(req: Request) {
  const profile = await requireInterpreterEligible(); // ✅ No leaks (APPROVED + ACTIVE only)

  const url = new URL(req.url);

  const status = parseStatusParams(url);
  const from = parseDateParam(url.searchParams.get("from"));
  const to = parseDateParam(url.searchParams.get("to"));

  const cursor = (url.searchParams.get("cursor") ?? "").trim() || null;

  const takeRaw = url.searchParams.get("take");
  const take = takeRaw ? Math.min(Math.max(Number(takeRaw), 1), 100) : undefined;

  const result = await listAssignmentsForInterpreter(profile.id, {
    status,
    from,
    to,
    cursor,
    take,
  });

  return NextResponse.json(
    { ok: true, ...result },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
