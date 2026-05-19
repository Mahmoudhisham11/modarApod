import { PageHeader } from "@/components/common/page-header";
import { ReportsPageClient } from "@/components/reports/reports-page-client";
import { getSessionUser } from "@/lib/auth/get-session";

export default async function ReportsPage() {
  const user = await getSessionUser();
  const shop = user?.branch ?? "";
  const branchLabel = user?.branch ?? "";

  return (
    <>
      <PageHeader title="التقارير" />
      <ReportsPageClient shop={shop} branchLabel={branchLabel} userEmail={user?.email ?? ""} />
    </>
  );
}
