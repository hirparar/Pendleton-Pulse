import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { MotionIn } from "@/components/motion";
import { notFound } from "next/navigation";
import Link from "next/link";
import { InterpreterAdminControls } from "./ui";
import { formatDateTimeISO } from "@/lib/datetime";
import {
  ArrowLeft, User, ShieldCheck, Clock, MapPin, Phone,
  Languages, Star, CheckCircle2, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PageProps = { params: Promise<{ id: string }> };

export default async function InterpreterDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  if (!id) notFound();

  const user = await prisma.userProfile.findUnique({
    where: { id },
    include: {
      interpreterProfile: true,
      auditEvents: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });

  if (!user) notFound();
  if (user.role !== "INTERPRETER") notFound();

  const name = user.interpreterProfile?.displayName ?? user.email ?? "Interpreter";

  function getInitials(s: string) {
    const parts = s.split(/[\s@.]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return s.slice(0, 2).toUpperCase();
  }

  return (
    <MotionIn className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white shadow-sm">
            {getInitials(name)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">{name}</h1>
            <p className="mt-0.5 text-sm text-zinc-500">{user.email ?? "No email"}</p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                user.isActive ? "border-sky-200 bg-sky-50 text-sky-700" : "border-zinc-200 bg-zinc-50 text-zinc-500"
              )}>
                {user.isActive ? "Active" : "Inactive"}
              </span>
              <span className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                user.status === "APPROVED" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : user.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-rose-200 bg-rose-50 text-rose-600"
              )}>
                {user.status}
              </span>
            </div>
          </div>
        </div>
        <Link
          href="/admin/interpreters"
          className="flex h-9 items-center gap-2 self-start rounded-xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </div>

      {/* Profile panels */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-4">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-50 ring-1 ring-indigo-200/60">
              <User className="size-3.5 text-indigo-600" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-950">Profile</h2>
          </div>
          <div className="divide-y divide-zinc-100 px-5">
            <InfoRow icon={User} label="Display name" value={user.interpreterProfile?.displayName ?? "—"} />
            <InfoRow icon={MapPin} label="Location" value={user.interpreterProfile?.location ?? "—"} />
            <InfoRow icon={Phone} label="Phone" value={user.interpreterProfile?.phone ?? "—"} />
            <InfoRow icon={Languages} label="Languages" value={(user.interpreterProfile?.languages ?? []).join(", ") || "—"} />
            <InfoRow icon={Star} label="Certifications" value={(user.interpreterProfile?.certifications ?? []).join(", ") || "—"} />
            <InfoRow icon={Clock} label="Experience" value={user.interpreterProfile?.experienceYears != null ? `${user.interpreterProfile.experienceYears} years` : "—"} />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-5 py-4">
            <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 ring-1 ring-emerald-200/60">
              <ShieldCheck className="size-3.5 text-emerald-600" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-950">Access review</h2>
          </div>
          <div className="divide-y divide-zinc-100 px-5">
            <InfoRow icon={ShieldCheck} label="Status" value={user.status} />
            <InfoRow icon={CheckCircle2} label="Active" value={user.isActive ? "Yes" : "No"} />
            <InfoRow icon={User} label="Reviewed by" value={user.reviewedBy ?? "—"} />
            <InfoRow icon={Clock} label="Reviewed at" value={user.reviewedAt ? formatDateTimeISO(user.reviewedAt) : "—"} />
            <InfoRow icon={ShieldCheck} label="Note" value={user.reviewNote ?? "—"} />
          </div>
        </div>
      </div>

      {/* Admin controls */}
      <InterpreterAdminControls
        userProfileId={user.id}
        isActive={user.isActive}
        status={user.status}
        initial={{
          languages: user.interpreterProfile?.languages ?? [],
          certifications: user.interpreterProfile?.certifications ?? [],
          experienceYears: user.interpreterProfile?.experienceYears ?? null,
        }}
      />

      {/* Audit log */}
      <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 transition hover:bg-zinc-50">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-zinc-100 ring-1 ring-zinc-200/60">
                <Clock className="size-3.5 text-zinc-500" />
              </div>
              <span className="text-sm font-semibold text-zinc-950">Audit log</span>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-500">
                {user.auditEvents.length}
              </span>
            </div>
            <span className="text-xs text-zinc-400 group-open:hidden">Expand</span>
            <span className="hidden text-xs text-zinc-400 group-open:block">Collapse</span>
          </summary>

          <div className="border-t border-zinc-100 px-5 pb-5">
            {user.auditEvents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10">
                <div className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-200 bg-zinc-50">
                  <Clock className="size-4 text-zinc-400" />
                </div>
                <p className="text-sm font-medium text-zinc-900">No audit events yet</p>
                <p className="text-xs text-zinc-500">Events will appear here after actions are taken.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {user.auditEvents.map((e) => (
                  <div key={e.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold text-zinc-950">{e.action}</p>
                        {e.note && <p className="mt-0.5 text-xs text-zinc-600">{e.note}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-zinc-400 tabular-nums">{formatDateTimeISO(e.createdAt)}</p>
                        {e.actor && <p className="text-[11px] text-zinc-400">{e.actor}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      </div>
    </MotionIn>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Icon className="size-3.5 shrink-0" />
        {label}
      </div>
      <div className="text-right text-sm font-medium text-zinc-950 max-w-xs truncate">{value}</div>
    </div>
  );
}
