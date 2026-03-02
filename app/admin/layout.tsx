import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/authz";
import { UserCluster } from "@/components/user-header";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();

  return (
    <AppShell
      accent="admin"
      title="Admin"
      subtitle="Create assignments and manage access."
      nav={[
        { href: "/admin", label: "Overview" },
        { href: "/admin/assignments", label: "Assignments", badge: "Primary" },
        { href: "/admin/approvals", label: "Approvals" },
        { href: "/admin/interpreters", label: "Interpreters" },
        { href: "/admin/availability", label: "Availability" },
      ]}
      right={<UserCluster status={profile.status} />}
    >
      {children}
    </AppShell>
  );
}
