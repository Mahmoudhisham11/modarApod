"use client";

import { Bell, Menu, PanelLeftClose, PanelLeft, Search } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * @param {{
 *   user: { email: string; name: string; role: string; branch?: string };
 *   onOpenNav: () => void;
 *   sidebarCollapsed?: boolean;
 *   onToggleSidebar?: () => void;
 * }} props
 */
export function AppHeader({ user, onOpenNav, sidebarCollapsed = false, onToggleSidebar }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/60 px-4 backdrop-blur">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenNav}
        aria-label="فتح القائمة"
      >
        <Menu className="h-4 w-4" />
      </Button>
      <div className="hidden max-w-md flex-1 items-center gap-2 md:flex">
        {onToggleSidebar ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="hidden shrink-0 lg:inline-flex"
            onClick={onToggleSidebar}
            aria-pressed={sidebarCollapsed}
            aria-label={sidebarCollapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"}
            title={sidebarCollapsed ? "توسيع القائمة" : "طي القائمة (أيقونات فقط)"}
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        ) : null}
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            readOnly
            placeholder="بحث عن عملية، فرع، أو خط…"
            className="h-9 w-full rounded-md border border-input bg-background ps-9 pe-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
      <div className="ms-auto flex items-center gap-3">
        <span className="hidden max-w-[14rem] flex-col items-end truncate text-end sm:flex md:max-w-xs">
          <span className="truncate text-xs font-medium text-foreground">{user.name}</span>
          {user.branch ? (
            <span className="truncate text-[10px] text-muted-foreground">{user.branch}</span>
          ) : null}
        </span>
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          النظام جاهز
        </span>
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
          aria-label="الإشعارات"
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="absolute top-2 end-2 h-1.5 w-1.5 rounded-full bg-accent" />
        </button>
      </div>
    </header>
  );
}
