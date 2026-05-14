import { cn } from "@/lib/utils";

/**
 * @param {{
 *   title: string;
 *   description?: string | null;
 *   size?: "default" | "compact";
 * }} props
 */
export function PageHeader({ title, description, size = "default" }) {
  const compact = size === "compact";
  return (
    <div className={cn(compact ? "space-y-0.5" : "space-y-1")}>
      <h1
        className={cn(
          "font-semibold tracking-tight text-foreground",
          compact ? "text-xl" : "text-2xl",
        )}
      >
        {title}
      </h1>
      {description ? (
        <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>{description}</p>
      ) : null}
    </div>
  );
}
