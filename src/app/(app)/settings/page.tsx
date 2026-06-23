import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { AdminHub } from "@/modules/settings/components/admin-hub";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Settings"
        description="Manage your organization, monitoring, access, and account preferences."
      />
      <AdminHub />
    </div>
  );
}
