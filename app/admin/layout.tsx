import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/lib/authz";
import { UserCluster } from "@/components/user-header";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const profile = await requireAdmin();

    return (
        <AppShell
            accent="admin"
            title="Admin"
            subtitle="Post jobs (primary) and manage access (secondary)."
            nav={[
                { href: "/admin", label: "Overview" },
                { href: "/admin/jobs", label: "Jobs", badge: "Primary" },
                { href: "/admin/interpreters", label: "Interpreters" },
            ]}
            right={<UserCluster status={profile.status} />}
        >
            {children}
        </AppShell>
    );
}
