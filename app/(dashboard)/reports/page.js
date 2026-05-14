import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="التقارير" description="تقارير الأداء والفترات." />
      <EmptyState title="التقارير" description="لا توجد تقارير جاهزة بعد." />
    </>
  );
}
