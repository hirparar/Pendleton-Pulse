"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
    approvePendingInterpreter,
    denyPendingInterpreter,
    bulkApprovePending,
    bulkDenyPending,
} from "./actions";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTimeISO } from "@/lib/datetime";

type InterpreterProfile = {
    displayName: string | null;
    location: string | null;
    languages: string[];
    certifications: string[];
    experienceYears: number | null;
    updatedAt: Date;
};

type ApprovalStatus = "PENDING" | "APPROVED" | "DENIED";

type Row = {
    id: string;
    email: string | null;
    status: ApprovalStatus;
    isActive: boolean;
    createdAt: Date;
    interpreterProfile: InterpreterProfile | null;
};

function ActivePill({ isActive }: { isActive: boolean }) {
    const cls = isActive
        ? "bg-sky-500/15 text-sky-800 border-sky-500/25 dark:text-sky-300"
        : "bg-zinc-500/15 text-zinc-800 border-zinc-500/25 dark:text-zinc-300";

    return (
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${cls}`}>
            {isActive ? "Active" : "Inactive"}
        </span>
    );
}

function PendingPill() {
    return (
        <span className="rounded-full border border-amber-500/25 bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:text-amber-300">
            Pending
        </span>
    );
}

export function ApprovalsTable({ initial }: { initial: Row[] }) {
    // Defensive: only show pending rows even if something upstream changes later
    const [rows, setRows] = useState<Row[]>(() => initial.filter((r) => r.status === "PENDING"));

    const [q, setQ] = useState("");
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const selectedIds = useMemo(
        () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
        [selected]
    );

    const [note, setNote] = useState("");
    const [isPending, startTransition] = useTransition();

    // Confirm dialogs
    const [confirmBulkOpen, setConfirmBulkOpen] = useState(false);
    const [bulkMode, setBulkMode] = useState<"APPROVE" | "DENY">("APPROVE");

    const [confirmOneOpen, setConfirmOneOpen] = useState(false);
    const [oneMode, setOneMode] = useState<"APPROVE" | "DENY">("APPROVE");
    const [activeRow, setActiveRow] = useState<Row | null>(null);

    const filtered = useMemo(() => {
        const query = q.trim().toLowerCase();
        const pendingOnly = rows.filter((r) => r.status === "PENDING");

        if (!query) return pendingOnly;

        return pendingOnly.filter((r) => {
            const name = r.interpreterProfile?.displayName ?? "";
            const email = r.email ?? "";
            const loc = r.interpreterProfile?.location ?? "";
            return (
                email.toLowerCase().includes(query) ||
                name.toLowerCase().includes(query) ||
                loc.toLowerCase().includes(query)
            );
        });
    }, [q, rows]);

    const shownIds = useMemo(() => filtered.map((r) => r.id), [filtered]);

    const allShownSelected = useMemo(() => {
        if (shownIds.length === 0) return false;
        return shownIds.every((id) => selected[id]);
    }, [shownIds, selected]);

    function selectAllShown() {
        setSelected((prev) => {
            const next = { ...prev };
            for (const id of shownIds) next[id] = true;
            return next;
        });
    }

    function clearAllShown() {
        setSelected((prev) => {
            const next = { ...prev };
            for (const id of shownIds) delete next[id];
            return next;
        });
    }

    function removeRows(ids: string[]) {
        const set = new Set(ids);
        setRows((prev) => prev.filter((r) => !set.has(r.id)));
        setSelected((prev) => {
            const next = { ...prev };
            for (const id of ids) delete next[id];
            return next;
        });
    }

    function openConfirmOne(r: Row, mode: "APPROVE" | "DENY") {
        setActiveRow(r);
        setOneMode(mode);
        setConfirmOneOpen(true);
    }

    function openConfirmBulk(mode: "APPROVE" | "DENY") {
        setBulkMode(mode);
        setConfirmBulkOpen(true);
    }

    function doOne() {
        if (!activeRow) return;

        startTransition(async () => {
            try {
                if (oneMode === "APPROVE") {
                    await approvePendingInterpreter({ userProfileId: activeRow.id, note });
                    removeRows([activeRow.id]);
                    toast.success("Approved", { description: "Interpreter is now approved." });
                } else {
                    await denyPendingInterpreter({ userProfileId: activeRow.id, note });
                    removeRows([activeRow.id]);
                    toast.success("Denied", { description: "Interpreter has been denied." });
                }

                setNote("");
                setConfirmOneOpen(false);
                setActiveRow(null);
            } catch {
                toast.error("Action failed", { description: "Try again." });
            }
        });
    }

    function doBulk() {
        if (selectedIds.length === 0) return;

        startTransition(async () => {
            try {
                if (bulkMode === "APPROVE") {
                    const res = await bulkApprovePending({ userProfileIds: selectedIds, note });
                    removeRows(selectedIds);
                    toast.success("Bulk approved", { description: `${res.updated} updated.` });
                } else {
                    const res = await bulkDenyPending({ userProfileIds: selectedIds, note });
                    removeRows(selectedIds);
                    toast.success("Bulk denied", { description: `${res.updated} updated.` });
                }

                setNote("");
                setConfirmBulkOpen(false);
            } catch {
                toast.error("Bulk action failed", { description: "Try again." });
            }
        });
    }

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-1 items-center gap-3">
                        <div className="min-w-[240px] flex-1">
                            <Input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Search email, name, location…"
                                className="h-11 rounded-2xl bg-white dark:bg-zinc-900"
                            />
                        </div>

                        <Badge variant="secondary" className="rounded-full">
                            {filtered.length} pending
                        </Badge>

                        {selectedIds.length > 0 ? (
                            <Badge variant="secondary" className="rounded-full">
                                {selectedIds.length} selected
                            </Badge>
                        ) : null}
                    </div>

                    {isPending ? (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">Saving…</div>
                    ) : null}
                </div>
            </div>

            {/* Bulk bar */}
            {selectedIds.length > 0 ? (
                <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-1">
                            <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
                                Bulk actions
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                Approve grants access (if active). Deny blocks access.
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                            <input
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Optional audit note…"
                                className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-950 sm:w-[320px]"
                                disabled={isPending}
                            />

                            <Button
                                className="h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-600/90"
                                disabled={isPending}
                                onClick={() => openConfirmBulk("APPROVE")}
                            >
                                Approve selected
                            </Button>

                            <Button
                                className="h-11 rounded-2xl bg-rose-600 hover:bg-rose-600/90"
                                disabled={isPending}
                                onClick={() => openConfirmBulk("DENY")}
                            >
                                Deny selected
                            </Button>

                            <Button
                                variant="secondary"
                                className="h-11 rounded-2xl"
                                disabled={isPending}
                                onClick={() => setSelected({})}
                            >
                                Clear
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Table */}
            <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="space-y-0.5">
                        <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
                            Pending interpreters
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                            Select rows for bulk review. Click View to open the interpreter record.
                        </div>
                    </div>
                </div>

                <Separator className="opacity-60" />

                <div className="max-h-[620px] overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur dark:bg-zinc-900/90">
                            <tr className="text-left text-xs text-zinc-500 dark:text-zinc-400">
                                <th className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={allShownSelected}
                                            onChange={(e) => (e.target.checked ? selectAllShown() : clearAllShown())}
                                            aria-label="Select all shown"
                                        />
                                        <span>Select</span>
                                    </div>
                                </th>
                                <th className="px-4 py-3">Interpreter</th>
                                <th className="px-4 py-3">Created</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-14">
                                        <EmptyState />
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((r) => (
                                    <tr
                                        key={r.id}
                                        className="group border-t border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/30"
                                    >
                                        <td className="px-4 py-4">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(selected[r.id])}
                                                onChange={(e) =>
                                                    setSelected((prev) => ({ ...prev, [r.id]: e.target.checked }))
                                                }
                                                aria-label={`Select ${r.email ?? r.id}`}
                                            />
                                        </td>

                                        <td className="px-4 py-4">
                                            <div className="space-y-0.5">
                                                <div className="font-medium tracking-tight text-zinc-950 dark:text-white">
                                                    {r.interpreterProfile?.displayName ?? r.email ?? "Unknown"}
                                                </div>
                                                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                                    {r.email ?? "No email"} · {r.interpreterProfile?.location ?? "No location"}
                                                </div>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <ActivePill isActive={r.isActive} />
                                                    <PendingPill />
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-4 py-4 text-zinc-600 dark:text-zinc-300">
                                            {formatDateTimeISO(r.createdAt)}
                                        </td>

                                        <td className="px-4 py-4 text-right">
                                            <div className="inline-flex items-center gap-2">
                                                <Link
                                                    href={`/admin/interpreters/${r.id}`}
                                                    className="inline-flex h-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800/60"
                                                >
                                                    View
                                                </Link>

                                                <Button
                                                    className="h-10 rounded-2xl bg-rose-600 hover:bg-rose-600/90"
                                                    disabled={isPending}
                                                    onClick={() => openConfirmOne(r, "DENY")}
                                                >
                                                    Deny
                                                </Button>

                                                <Button
                                                    className="h-10 rounded-2xl bg-emerald-600 hover:bg-emerald-600/90"
                                                    disabled={isPending}
                                                    onClick={() => openConfirmOne(r, "APPROVE")}
                                                >
                                                    Approve
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Confirm one */}
            <Dialog open={confirmOneOpen} onOpenChange={setConfirmOneOpen}>
                <DialogContent className="rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="tracking-tight">
                            {oneMode === "APPROVE" ? "Approve interpreter?" : "Deny interpreter?"}
                        </DialogTitle>
                        <DialogDescription>
                            {oneMode === "APPROVE"
                                ? "Approving grants job feed access if the interpreter is active."
                                : "Denying blocks access and routes the interpreter to the denied gate."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                        <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            Optional audit note
                        </div>
                        <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Short factual note…"
                            className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-950"
                            disabled={isPending}
                        />
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button
                            variant="secondary"
                            className="h-11 rounded-2xl"
                            disabled={isPending}
                            onClick={() => setConfirmOneOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className={[
                                "h-11 rounded-2xl",
                                oneMode === "APPROVE"
                                    ? "bg-emerald-600 hover:bg-emerald-600/90"
                                    : "bg-rose-600 hover:bg-rose-600/90",
                            ].join(" ")}
                            disabled={isPending}
                            onClick={doOne}
                        >
                            {isPending ? "Saving…" : "Confirm"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Confirm bulk */}
            <Dialog open={confirmBulkOpen} onOpenChange={setConfirmBulkOpen}>
                <DialogContent className="rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="tracking-tight">
                            {bulkMode === "APPROVE"
                                ? "Approve selected interpreters?"
                                : "Deny selected interpreters?"}
                        </DialogTitle>
                        <DialogDescription>
                            This updates {selectedIds.length} selected pending interpreters.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                        <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            Optional audit note
                        </div>
                        <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Short factual note…"
                            className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-zinc-800 dark:bg-zinc-950"
                            disabled={isPending}
                        />
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button
                            variant="secondary"
                            className="h-11 rounded-2xl"
                            disabled={isPending}
                            onClick={() => setConfirmBulkOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className={[
                                "h-11 rounded-2xl",
                                bulkMode === "APPROVE"
                                    ? "bg-emerald-600 hover:bg-emerald-600/90"
                                    : "bg-rose-600 hover:bg-rose-600/90",
                            ].join(" ")}
                            disabled={isPending}
                            onClick={doBulk}
                        >
                            {isPending ? "Saving…" : "Confirm"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
            <div className="h-12 w-12 rounded-3xl bg-zinc-100 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700" />
            <div className="text-sm font-semibold tracking-tight text-zinc-950 dark:text-white">
                No pending interpreters
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                When interpreters sign up, pending accounts will appear here.
            </div>
        </div>
    );
}
