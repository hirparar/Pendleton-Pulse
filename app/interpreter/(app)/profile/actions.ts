"use server";

import { revalidatePath } from "next/cache";
import { requireInterpreterEligible } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  basicInfoSchema,
  credentialsSchema,
  preferencesSchema,
} from "@/lib/validation/interpreter-profile";

function toFieldErrors(error: any) {
  const flattened = error.flatten?.();
  return flattened?.fieldErrors ?? {};
}

async function savePartialProfile(
  userProfileId: string,
  update: Record<string, unknown>
) {
  await prisma.interpreterProfile.upsert({
    where: { userProfileId },
    update,
    create: { userProfileId, ...update },
  });

  revalidatePath("/interpreter/profile");
  revalidatePath("/interpreter/dashboard");
}

export async function saveBasicInfoAction(input: {
  displayName: string;
  phone: string;
  location: string;
  bio: string;
  experienceYears: number | null;
  timezone: string;
}) {
  const me = await requireInterpreterEligible();

  const parsed = basicInfoSchema.safeParse({
    ...input,
    experienceYears:
      typeof input.experienceYears === "number" ? input.experienceYears : Number(input.experienceYears),
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      errors: toFieldErrors(parsed.error),
      message: "Please fix the highlighted fields.",
    };
  }

  await savePartialProfile(me.id, parsed.data);

  return {
    ok: true as const,
    message: "Basic info saved.",
  };
}

export async function saveCredentialsAction(input: {
  languages: string[];
  certifications: string[];
}) {
  const me = await requireInterpreterEligible();

  const parsed = credentialsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false as const,
      errors: toFieldErrors(parsed.error),
      message: "Please fix the highlighted fields.",
    };
  }

  await savePartialProfile(me.id, parsed.data);

  return {
    ok: true as const,
    message: "Credentials saved.",
  };
}

export async function savePreferencesAction(input: {
  preferredModes: string[];
}) {
  const me = await requireInterpreterEligible();

  const parsed = preferencesSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false as const,
      errors: toFieldErrors(parsed.error),
      message: "Please fix the highlighted fields.",
    };
  }

  await savePartialProfile(me.id, parsed.data);

  return {
    ok: true as const,
    message: "Preferences saved.",
  };
}