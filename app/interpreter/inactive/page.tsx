import Link from "next/link";
import { MotionIn } from "@/components/motion";
import { SignOutButton } from "@clerk/nextjs";

export default function InactivePage() {
  return (
    <MotionIn className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <section className="relative overflow-hidden rounded-[32px] border border-zinc-200/80 bg-white/95 p-8 shadow-[0_20px_80px_-30px_rgba(0,0,0,0.25)] backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95 sm:p-10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-zinc-100/80 to-transparent dark:from-zinc-800/40" />

          <div className="relative flex flex-col items-center text-center">
            <div className="mb-4 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              Interpreter account status
            </div>

            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7 text-zinc-700 dark:text-zinc-200"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M16 16v-1a4 4 0 0 0-8 0v1" />
                <circle cx="12" cy="7" r="3" />
                <path d="M18 8h3" />
                <path d="M21 5v6" />
              </svg>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-4xl">
              Your account is inactive
            </h1>

            <p className="mt-3 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-300 sm:text-base">
              You are signed in, but this interpreter account is currently inactive. If this does not look right,
              contact your administrator or switch to a different account.
            </p>

            <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
              <SignOutButton redirectUrl="/sign-in">
                <button
                  type="button"
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-900 transition hover:-translate-y-0.5 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
                >
                  Switch account
                </button>
              </SignOutButton>
            </div>
          </div>
        </section>
      </div>
    </MotionIn>
  );
}