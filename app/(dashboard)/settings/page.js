import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="الإعدادات" description="إعدادات المنشأة والتكاملات." />
      <EmptyState title="إعدادات النظام" description="لم تُعرَّف إعدادات بعد." />
    </>
  );
}
