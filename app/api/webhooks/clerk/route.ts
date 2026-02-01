import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhook } from "@clerk/nextjs/webhooks";

// Optional: seed admins via env list
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export async function POST(req: Request) {
  let evt: { type: string; data: any };

  try {
    // verifyWebhook requires the raw body + headers
    evt = await verifyWebhook(req);
  } catch (err) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  // We only need to handle user.created for now
  if (evt.type === "user.created") {
    const clerkUserId: string = evt.data.id;

    // emails array format can vary; this is the common shape
    const primaryEmail =
      evt.data.email_addresses?.find((e: any) => e.id === evt.data.primary_email_address_id)
        ?.email_address ??
      evt.data.email_addresses?.[0]?.email_address ??
      null;

    const isAdmin = primaryEmail ? adminEmails.includes(primaryEmail.toLowerCase()) : false;

    // Production-grade: idempotent upsert (webhooks can retry / deliver twice)
    await prisma.userProfile.upsert({
      where: { clerkUserId },
      create: {
        clerkUserId,
        email: primaryEmail,
        role: isAdmin ? "ADMIN" : "INTERPRETER",
        status: isAdmin ? "APPROVED" : "PENDING",
      },
      update: {
        // keep email in sync if Clerk changes it later
        email: primaryEmail ?? undefined,
      },
    });
  }

  return NextResponse.json({ received: true });
}
