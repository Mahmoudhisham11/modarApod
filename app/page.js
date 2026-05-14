import { redirect } from "next/navigation";

import { PageHeader } from "@/components/common/page-header";
import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getSessionUser } from "@/lib/auth/get-session";

/**
 * الصفحة الرئيسية `/` — خارج مجموعة (dashboard) لضمان تسجيل المسار بشكل صريح في Next 16.
 * نفس المحتوى السابق لـ app/(dashboard)/page.js مع التحقق من الجلسة (لا يمرّ عبر layout المجموعة لهذا المسار).
 */
export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const shop = user.branch ?? "";
  const branchLabel = user.branch ?? "";

  return (
    <DashboardShell user={user}>
      <PageHeader title="لوحة التحكم" />
      <DashboardPageClient shop={shop} branchLabel={branchLabel} />
    </DashboardShell>
  );
}
