import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) redirect("/sign-in");

  const profile = await prisma.userProfile.findUnique({
    where: { clerkUserId: userId },
    select: { role: true },
  });

  if (profile?.role === "ADMIN") redirect("/admin");
  if (profile?.role === "INTERPRETER") redirect("/interpreter/dashboard");

  redirect("/sign-in");
}