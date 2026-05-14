import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * @param {{ title: string; description?: string }} props
 */
export function EmptyState({ title, description }) {
  return (
    <Card className="mt-6 shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">لا توجد بيانات بعد.</p>
      </CardContent>
    </Card>
  );
}
