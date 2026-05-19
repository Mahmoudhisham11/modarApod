"use client";

import { useState } from "react";

import { SubscriptionGuard } from "@/components/auth/subscription-guard";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * @param {{ user: { email: string; name: string; role: string; branch?: string }; children: import("react").ReactNode }} props
 */
export function DashboardShell({ user, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* شريط ثابت على الشاشات الكبيرة — RTL: start = يمين الشاشة */}
      <div
        className={cn(
          "hidden h-[100dvh] shrink-0 flex-col overflow-hidden border-sidebar-border transition-[width] duration-200 ease-out lg:fixed lg:inset-y-0 lg:start-0 lg:z-30 lg:flex lg:border-e",
          sidebarCollapsed ? "w-[4.25rem] lg:w-[4.25rem]" : "w-64 lg:w-64",
        )}
      >
        <AppSidebar
          user={user}
          collapsed={sidebarCollapsed}
          className="h-full min-h-0 flex-1 lg:border-e-0"
        />
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-[18rem] border-sidebar-border bg-sidebar p-0">
          <AppSidebar
            user={user}
            className="h-full min-h-0"
            variant="mobile"
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* مساحة بادئة = عرض الشريط حتى لا يغطي المحتوى؛ التمرير يعود للصفحة كاملة */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-out",
          sidebarCollapsed ? "lg:ps-[4.25rem]" : "lg:ps-64",
        )}
      >
        <AppHeader
          shop={user.branch ?? ""}
          onOpenNav={() => setMobileOpen(true)}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
        />
        <main className="flex-1 p-6">
          <SubscriptionGuard userEmail={user.email}>{children}</SubscriptionGuard>
        </main>
      </div>
    </div>
  );
}
