import { PageHeader } from "@/components/common/page-header";
import { SettingsPageClient } from "@/components/settings/settings-page-client";
import { getSessionUser } from "@/lib/auth/get-session";

export default async function SettingsPage() {
  const user = await getSessionUser();
  const userEmail = user?.email ?? "";

  return (
    <>
      <PageHeader title="الإعدادات" />
      <SettingsPageClient userEmail={userEmail} />
    </>
  );
}
