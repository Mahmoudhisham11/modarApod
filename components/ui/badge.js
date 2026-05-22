import { cn } from "@/lib/utils";

/**
 * @param {import("react").HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "destructive" | "outline" }} props
 */
export function Badge({ className, variant = "default", ...rest }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variant === "default" && "border-transparent bg-primary text-primary-foreground shadow",
        variant === "destructive" && "border-transparent bg-destructive text-destructive-foreground shadow",
        variant === "outline" && "text-foreground",
        className,
      )}
      {...rest}
    />
  );
}
