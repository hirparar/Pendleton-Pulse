import { MotionIn } from "@/components/motion";
import { SignOutButton } from "@clerk/nextjs";
import { UserX, ArrowLeft, Mail } from "lucide-react";

export default function InactivePage() {
  return (
    <MotionIn className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="relative overflow-hidden rounded-2xl border border-amber-200/80 bg-white p-8 shadow-sm">
          {/* Top accent */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

          <div className="flex flex-col items-center text-center">
            {/* Status badge */}
            <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Account inactive
            </div>

            {/* Icon */}
            <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
              <UserX className="size-7 text-amber-600" />
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
              Your account is inactive
            </h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-500">
              You&apos;re signed in, but this interpreter account has been
              deactivated. Contact your administrator to restore access.
            </p>
          </div>

          {/* Info */}
          <div className="mt-8 flex items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
            <Mail className="mt-0.5 size-4 shrink-0 text-zinc-400" />
            <p className="text-xs leading-relaxed text-zinc-500">
              If this doesn&apos;t look right, reach out to your admin and provide
              your registered email address.
            </p>
          </div>

          {/* Actions */}
          <div className="mt-6">
            <SignOutButton redirectUrl="/sign-in">
              <button
                type="button"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                <ArrowLeft className="size-4" />
                Switch account
              </button>
            </SignOutButton>
          </div>
        </div>
      </div>
    </MotionIn>
  );
}
