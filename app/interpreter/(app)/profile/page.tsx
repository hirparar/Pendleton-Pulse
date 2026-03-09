// app/interpreter/(app)/profile/page.tsx
import { requireInterpreterEligible } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { MotionIn } from "@/components/motion";
import { ProfileEditor } from "./ui";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await requireInterpreterEligible();

  const [userProfile, interpreterProfile] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { id: me.id },
      select: { email: true, createdAt: true, status: true, isActive: true },
    }),
    prisma.interpreterProfile.findUnique({
      where: { userProfileId: me.id },
      select: {
        displayName: true, phone: true, location: true, bio: true,
        languages: true, certifications: true, experienceYears: true,
        preferredModes: true, timezone: true,
      },
    }),
  ]);

  return (
    <MotionIn className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
          Profile
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Keep your credentials accurate — admins filter by language and certification when staffing jobs.
        </p>
      </header>

      <ProfileEditor
        userProfileId={me.id}
        email={userProfile?.email ?? null}
        joinedAt={userProfile?.createdAt?.toISOString() ?? null}
        status={userProfile?.status ?? "PENDING"}
        isActive={userProfile?.isActive ?? true}
        initial={interpreterProfile ?? {
          displayName: null, phone: null, location: null, bio: null,
          languages: [], certifications: [], experienceYears: null,
          preferredModes: [], timezone: "America/New_York",
        }}
      />
    </MotionIn>
  );
}