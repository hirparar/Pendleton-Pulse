import Link from "next/link";
import { MotionIn } from "@/components/motion";
import { XCircle, ArrowLeft, Mail } from "lucide-react";

export default function DeniedPage() {
  return (
    <MotionIn className="mx-auto max-w-lg">
      <div className="relative overflow-hidden rounded-2xl border border-rose-200/80 bg-white p-8">
        {/* Top accent */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-rose-400 to-transparent" />

        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-rose-200 bg-rose-50 shadow-sm">
            <XCircle className="size-7 text-rose-600" />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
            Access request denied
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-500">
            Your interpreter access request was not approved. If you believe this
            is a mistake, please reach out to your administrator.
          </p>
        </div>

        {/* What to do */}
        <div className="mt-8 space-y-2">
          <div className="flex items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
            <Mail className="mt-0.5 size-4 shrink-0 text-zinc-400" />
            <div>
              <p className="text-sm font-medium text-zinc-700">Contact your admin</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                Ask them to review your application or provide feedback on the denial.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6">
          <Link
            href="/sign-in"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            <ArrowLeft className="size-4" />
            Switch account
          </Link>
        </div>
      </div>
    </MotionIn>
  );
}
