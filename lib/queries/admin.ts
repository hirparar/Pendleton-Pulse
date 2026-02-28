import { prisma } from "@/lib/prisma";

export async function getAdminOverviewMetrics() {
  const [
    totalInterpreters,
    activeInterpreters,
    inactiveInterpreters,
    pendingApprovals,
  ] = await Promise.all([
    prisma.userProfile.count({ where: { role: "INTERPRETER" } }),
    prisma.userProfile.count({
      where: { role: "INTERPRETER", isActive: true },
    }),
    prisma.userProfile.count({
      where: { role: "INTERPRETER", isActive: false },
    }),
    prisma.userProfile.count({
      where: { role: "INTERPRETER", status: "PENDING" },
    }),
  ]);

  return {
    totalInterpreters,
    activeInterpreters,
    inactiveInterpreters,
    pendingApprovals,
  };
}

export async function listInterpreters(params?: {
  q?: string;
  status?: "PENDING" | "APPROVED" | "DENIED";
  active?: "true" | "false";
}) {
  const q = params?.q?.trim();
  const status = params?.status;
  const active = params?.active;

  return prisma.userProfile.findMany({
    where: {
      role: "INTERPRETER",
      ...(status ? { status } : {}),
      ...(active ? { isActive: active === "true" } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              {
                interpreterProfile: {
                  displayName: { contains: q, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      interpreterProfile: true,
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200, // safety cap; later add pagination
  });
}

export async function getInterpreterProfileById(userProfileId: string) {
  return prisma.userProfile.findUnique({
    where: { id: userProfileId },
    include: {
      interpreterProfile: true,
      auditEvents: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });
}

export async function listPendingApprovals() {
  return prisma.userProfile.findMany({
    where: { role: "INTERPRETER", status: "PENDING" },
    include: { interpreterProfile: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
}
