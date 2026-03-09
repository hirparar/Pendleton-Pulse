import { AppShell } from "@/components/app-shell";
import { requireInterpreterEligible } from "@/lib/authz";
import { UserCluster } from "@/components/user-header";

export default async function InterpreterApprovedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireInterpreterEligible();

  return (
    <AppShell
      accent="interpreter"
      title="Jobs"
      subtitle="Discover interpreting jobs posted by admins. Your feed updates as new jobs are posted."
      nav={[
        { href: "/interpreter/dashboard", label: "Overview" },
        { href: "/interpreter/jobs", label: "Job feed", badge: "Primary" },
        { href: "/interpreter/availability", label: "Availability" },
        { href: "/interpreter/profile", label: "Profile" },
      ]}
      right={<UserCluster status={profile.status} />}
    >
      {children}
    </AppShell>
  );
}
