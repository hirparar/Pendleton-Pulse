import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";
import Link from "next/link";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function InterpreterDetailPage({ params }: PageProps) {
  await requireAdmin();

  const { id } = await params;

  if (!id) notFound();

  const user = await prisma.userProfile.findUnique({
    where: { id },
    include: {
      interpreterProfile: true,
      auditEvents: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });

  if (!user) notFound();

  return (
    <MotionIn className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            {user.interpreterProfile?.displayName ?? user.email ?? "Interpreter"}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Full profile and audit trail. Jobs history will appear here later.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {user.status}
          </Badge>
          <Link
            href="/admin/interpreters"
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800/60"
          >
            Back
          </Link>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="Identity">
          <Row label="Email" value={user.email ?? "—"} />
          <Row label="Clerk ID" value={user.clerkUserId} />
          <Row label="Created" value={new Date(user.createdAt).toLocaleString()} />
        </Panel>

        <Panel title="Profile">
          <Row label="Location" value={user.interpreterProfile?.location ?? "—"} />
          <Row label="Phone" value={user.interpreterProfile?.phone ?? "—"} />
          <Row label="Experience" value={user.interpreterProfile?.experienceYears?.toString() ?? "—"} />
        </Panel>

        <Panel title="Access review">
          <Row label="Reviewed by" value={user.reviewedBy ?? "—"} />
          <Row label="Reviewed at" value={user.reviewedAt ? new Date(user.reviewedAt).toLocaleString() : "—"} />
          <Row label="Note" value={user.reviewNote ?? "—"} />
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Languages">
          <div className="text-sm text-zinc-700 dark:text-zinc-300">
            {(user.interpreterProfile?.languages ?? []).length
              ? user.interpreterProfile!.languages.join(", ")
              : "—"}
          </div>
        </Panel>

        <Panel title="Certifications">
          <div className="text-sm text-zinc-700 dark:text-zinc-300">
            {(user.interpreterProfile?.certifications ?? []).length
              ? user.interpreterProfile!.certifications.join(", ")
              : "—"}
          </div>
        </Panel>
      </section>

      <Panel title="Audit events">
        <div className="space-y-3">
          {user.auditEvents.length === 0 ? (
            <div className="text-sm text-zinc-600 dark:text-zinc-300">No events yet.</div>
          ) : (
            user.auditEvents.map((e) => (
              <div
                key={e.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-zinc-950 dark:text-white">{e.action}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      Actor: {e.actor ?? "—"} · {new Date(e.createdAt).toLocaleString()}
                    </div>
                    {e.note ? (
                      <div className="text-sm text-zinc-700 dark:text-zinc-300">{e.note}</div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </MotionIn>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">{title}</div>
      <div className="mt-4 space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">{label}</div>
      <div className="text-sm font-medium text-zinc-950 dark:text-white text-right">{value}</div>
    </div>
  );
}
