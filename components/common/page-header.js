import { cn } from "@/lib/utils";

/**
 * @param {{
 *   title: string;
 *   description?: string | null;
 *   size?: "default" | "compact";
 *   actions?: import("react").ReactNode;
 *   className?: string;
 * }} props
 */
export function PageHeader({ title, description, size = "default", actions, className }) {
  const compact = size === "compact";
  return (
    <div
      className={cn(
        "flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between",
        compact ? "mb-4" : "mb-6",
        className,
      )}
    >
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
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
