import { PageHeader } from "@/components/common/page-header";
import { DebtsPageClient } from "@/components/debts/debts-page-client";
import { getSessionUser } from "@/lib/auth/get-session";

export default async function DebtsPage() {
  const user = await getSessionUser();
  const userEmail = user?.email ?? "";
  const shop = user?.branch ?? "";

  return (
    <>
      <PageHeader title="الديون" description="إدارة الديون وسجل السداد" />
      <DebtsPageClient shop={shop} userEmail={userEmail} />
    </>
  );
}
