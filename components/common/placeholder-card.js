import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function PlaceholderCard({ title, body }) {
  return (
    <Card className="mt-6 shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>سيتم ربط البيانات والواجهات التفصيلية لاحقًا بعد اعتماد التصميم المرجعي.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      </CardContent>
    </Card>
  );
}
