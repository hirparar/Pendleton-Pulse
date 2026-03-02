import { auth, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { unstable_noStore as noStore } from "next/cache";

export async function ensureUserProfile() {
  noStore();
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await prisma.userProfile.findUnique({
    where: { clerkUserId: userId },
  });
  if (existing) return existing;

  // Fallback: fetch from Clerk (webhook might not have fired yet)
  const user = await (await clerkClient()).users.getUser(userId);
  const primaryEmail =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ?? null;

  return prisma.$transaction(async (tx) => {
    const profile = await tx.userProfile.upsert({
      where: { clerkUserId: userId },
      create: {
        clerkUserId: userId,
        email: primaryEmail,
        role: "INTERPRETER",
        status: "PENDING",
      },
      update: {
        email: primaryEmail ?? undefined,
      },
    });

    if (profile.role === "INTERPRETER") {
      await tx.interpreterProfile.upsert({
        where: { userProfileId: profile.id },
        create: { userProfileId: profile.id },
        update: {},
      });
    }

    return profile;
  });
}
