import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhook } from "@clerk/nextjs/webhooks";

// Optional: seed admins via env list
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export const runtime = "nodejs";

// Minimal shape we rely on (keeps this resilient to Clerk payload changes)
type ClerkWebhookEvent = {
  type: string;
  data: any;
};

function getPrimaryEmail(data: any): string | null {
  const primary =
    data.email_addresses?.find((e: any) => e.id === data.primary_email_address_id)?.email_address ??
    data.email_addresses?.[0]?.email_address ??
    null;

  return primary ? String(primary) : null;
}

export async function POST(req: NextRequest) {
  let evt: ClerkWebhookEvent;

  try {
    evt = (await verifyWebhook(req)) as ClerkWebhookEvent;
  } catch (err) {
    console.error("Webhook verification error:", err);
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  // We care about created + updated so email changes don't desync your DB
  if (evt.type !== "user.created" && evt.type !== "user.updated") {
    return NextResponse.json({ received: true });
  }

  const clerkUserId: string = evt.data.id;
  const primaryEmail = getPrimaryEmail(evt.data);

  const isAdmin = primaryEmail ? adminEmails.includes(primaryEmail.toLowerCase()) : false;
  const role = isAdmin ? "ADMIN" : "INTERPRETER";
  const status = isAdmin ? "APPROVED" : "PENDING";

  try {
    await prisma.$transaction(async (tx) => {
      // 1) Upsert the base UserProfile (idempotent)
      const user = await tx.userProfile.upsert({
        where: { clerkUserId },
        create: {
          clerkUserId,
          email: primaryEmail,
          role,
          status,
        },
        update: {
          // Keep email in sync
          email: primaryEmail ?? undefined,

          // IMPORTANT:
          // We do NOT auto-promote/demote roles on user.updated unless you explicitly want that.
          // If you want role changes to be driven by env list, you can uncomment:
          // role,
          // status,
        },
        select: { id: true, role: true },
      });

      // 2) Ensure InterpreterProfile exists for interpreters only
      // This is a hard guarantee that makes your admin "Interpreters list" stable.
      if (user.role === "INTERPRETER") {
        await tx.interpreterProfile.upsert({
          where: { userProfileId: user.id },
          create: { userProfileId: user.id },
          update: {}, // nothing to update; existence guarantee only
        });
      }
    });
  } catch (err) {
    console.error("Webhook DB write error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
