"use client";

import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { ExecuteOperationForm } from "./execute-operation-form";

/**
 * @param {{ shop: string; userEmail: string; userName: string }} props
 */
export function OperationsPageClient({ shop, userEmail, userName }) {
  if (!shop.trim()) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="العمليات" />
        <Card className="border-border/60 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle>اسم الفرع غير مضبوط</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="العمليات" />
      <ExecuteOperationForm shop={shop} userEmail={userEmail} userName={userName} />
    </div>
  );
}
