"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Briefcase,
  UserCheck,
  Users,
  Calendar,
  Rss,
  User,
  ChevronRight,
} from "lucide-react";

type NavItem = { href: string; label: string; badge?: string };

function getIcon(href: string) {
  if (href === "/admin" || href.endsWith("/dashboard")) return LayoutDashboard;
  if (href.includes("assignments")) return Briefcase;
  if (href.includes("approvals")) return UserCheck;
  if (href.includes("interpreters")) return Users;
  if (href.includes("availability")) return Calendar;
  if (href.includes("jobs")) return Rss;
  if (href.includes("profile")) return User;
  return ChevronRight;
}

export function NavLinks({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5 px-2">
      {nav.map((item) => {
        const Icon = getIcon(item.href);
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150",
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/80"
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0 transition-colors duration-150",
                isActive
                  ? "text-primary"
                  : "text-zinc-400 group-hover:text-zinc-600"
              )}
            />
            <span className="flex-1 tracking-tight">{item.label}</span>
            {item.badge ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "bg-zinc-100 text-zinc-500"
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
