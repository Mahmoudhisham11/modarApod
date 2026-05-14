"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { mainNavItems } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";

function isActivePath(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initialsFromName(name, email) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  const e = (email || "").split("@")[0] || "";
  return e.slice(0, 2).toUpperCase() || "—";
}

/**
 * @param {{
 *   user: { email: string; name: string; role: string; branch?: string };
 *   className?: string;
 *   onNavigate?: () => void;
 *   variant?: "desktop" | "mobile";
 *   collapsed?: boolean;
 * }} props
 */
export function AppSidebar({ user, className, onNavigate, variant = "desktop", collapsed = false }) {
  const pathname = usePathname();
  const router = useRouter();
  const initials = initialsFromName(user.name, user.email);
  const isCollapsed = variant === "desktop" && collapsed;

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("logout failed");
      toast.success("تم تسجيل الخروج");
      onNavigate?.();
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("تعذر تسجيل الخروج");
    }
  };

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground",
        variant === "desktop" && "border-sidebar-border lg:border-e",
        className,
      )}
    >
      <div className={cn("border-b border-sidebar-border px-3 py-3", isCollapsed && "px-2")}>
        <div
          className={cn(
            "flex items-center gap-2 px-1",
            isCollapsed && "justify-center px-0",
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <span className="text-xs font-bold">م</span>
          </div>
          <div
            className={cn(
              "flex min-w-0 flex-col leading-tight",
              isCollapsed && "sr-only",
            )}
          >
            <span className="truncate text-sm font-semibold text-sidebar-foreground">مدار</span>
            <span className="truncate text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
              إدارة محلات الدفع
            </span>
          </div>
        </div>
      </div>

      <nav className={cn("flex-1 overflow-y-auto px-2 py-4", isCollapsed && "px-1")}>
        <p
          className={cn(
            "mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/50",
            isCollapsed && "sr-only",
          )}
        >
          القائمة
        </p>
        <ul className="space-y-0.5">
          {mainNavItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={item.label}
                  onClick={() => onNavigate?.()}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors",
                    isCollapsed && "justify-center px-0 py-2.5",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/90 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-90" />
                  <span className={cn("truncate", isCollapsed && "sr-only")}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={cn("border-t border-sidebar-border p-2", isCollapsed && "px-1")}>
        <div
          className={cn(
            "mb-2 flex items-center gap-2 rounded-md px-2 py-2",
            isCollapsed && "justify-center px-0",
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
            {initials}
          </div>
          <div className={cn("min-w-0 flex-1 leading-tight", isCollapsed && "sr-only")}>
            <p className="truncate text-xs font-medium text-sidebar-foreground">{user.name}</p>
            <p className="truncate text-[10px] text-sidebar-foreground/60">{user.email}</p>
            {user.branch ? (
              <p className="truncate text-[10px] text-sidebar-foreground/50">{user.branch}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          title="تسجيل الخروج"
          onClick={() => void handleLogout()}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm text-sidebar-foreground/90 transition-colors hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground",
            isCollapsed && "justify-center px-0",
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className={cn(isCollapsed && "sr-only")}>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
