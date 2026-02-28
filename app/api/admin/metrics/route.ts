import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

// IMPORTANT: never cache metrics
export const dynamic = "force-dynamic";

type Metrics = {
  totalInterpreters: number;
  activeInterpreters: number;
  inactiveInterpreters: number;
  pendingApprovals: number;
};

export async function GET() {
  await requireAdmin();

  try {
    const [totalInterpreters, activeInterpreters, inactiveInterpreters, pendingApprovals] =
      await Promise.all([
        prisma.userProfile.count({ where: { role: "INTERPRETER" } }),
        prisma.userProfile.count({ where: { role: "INTERPRETER", isActive: true } }),
        prisma.userProfile.count({ where: { role: "INTERPRETER", isActive: false } }),
        prisma.userProfile.count({ where: { role: "INTERPRETER", status: "PENDING" } }),
      ]);

    const payload: Metrics = {
      totalInterpreters,
      activeInterpreters,
      inactiveInterpreters,
      pendingApprovals,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Metrics failed to load." },
      { status: 500, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  }
}
