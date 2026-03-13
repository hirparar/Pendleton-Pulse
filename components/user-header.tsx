"use client";

import { UserButton } from "@clerk/nextjs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function StatusPill({ status }: { status: "PENDING" | "APPROVED" | "DENIED" }) {
  const map = {
    APPROVED: "bg-emerald-500/15 text-emerald-700 border-emerald-500/25",
    PENDING: "bg-amber-500/15 text-amber-800 border-amber-500/25",
    DENIED: "bg-rose-500/15 text-rose-800 border-rose-500/25",
  }[status];

  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", map)}>
      {status === "APPROVED" ? "Approved" : status === "PENDING" ? "Pending" : "Denied"}
    </span>
  );
}

export function UserCluster({ status }: { status: "PENDING" | "APPROVED" | "DENIED" }) {
  return (
    <>
      <StatusPill status={status} />
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-2 py-1">
        <UserButton
        afterSignOutUrl=""
        appearance={{ elements: { userButtonAvatarBox: "h-7 w-7" } }} />
      </div>
    </>
  );
}
