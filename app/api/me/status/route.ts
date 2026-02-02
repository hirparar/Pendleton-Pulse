import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  const profile = await prisma.userProfile.findUnique({
    where: { clerkUserId: userId },
    select: { role: true, status: true },
  });

  if (!profile) return NextResponse.json({ ok: false }, { status: 404 });

  return NextResponse.json({ ok: true, ...profile });
}
