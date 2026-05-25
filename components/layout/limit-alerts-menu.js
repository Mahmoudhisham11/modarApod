"use client";

import { useState } from "react";
import { Bell } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLimitAlerts } from "@/hooks/use-limit-alerts";
import { useDebtAlerts } from "@/hooks/use-debt-alerts";
import { cn } from "@/lib/utils";

/**
 * @param {{ shop: string }} props
 */
export function LimitAlertsMenu({ shop }) {
  const [open, setOpen] = useState(false);
  const { alerts, activationAlerts, loading, reload, count: limitCount } = useLimitAlerts(shop, { enabled: true });
  const { debts: debtAlerts, loading: debtLoading, reload: debtReload, count: debtCount } = useDebtAlerts(shop, { enabled: true });

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) { void reload(); void debtReload(); }
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 shrink-0"
          aria-label="التنبيهات"
        >
          <Bell className="h-4 w-4 text-muted-foreground" />
          {limitCount + debtCount > 0 ? (
            <span className="absolute top-1.5 end-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {limitCount + debtCount > 9 ? "9+" : limitCount + debtCount}
            </span>
          ) : (
            <span className="absolute top-2 end-2 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-[70vh] overflow-y-auto">
        {loading || debtLoading ? (
          <DropdownMenuItem disabled>جاري التحميل…</DropdownMenuItem>
        ) : limitCount + debtCount === 0 ? (
          <DropdownMenuItem disabled>لا توجد تنبيهات</DropdownMenuItem>
        ) : (
          <>
            {debtAlerts.length > 0 ? (
              <>
                <DropdownMenuLabel>ديون مستحقة</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {debtAlerts.map((d) => (
                  <div key={`debt-${d.id}`} className="px-2 py-2">
                    <p className="text-sm font-medium text-foreground">
                      {d.customerName}
                      {d.type === "ليك" ? (
                        <span className="text-emerald-600 me-1">لك</span>
                      ) : (
                        <span className="text-red-600 me-1">عليك</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      المبلغ: {d.amount.toFixed(2)} — متبقي: {d.remaining.toFixed(2)}
                    </p>
                    <p className={cn(
                      "text-xs",
                      d.daysLeft < 0 ? "text-destructive" : d.daysLeft <= 3 ? "text-warning" : "text-muted-foreground",
                    )}>
                      {d.daysLeft < 0
                        ? `متأخر ${Math.abs(d.daysLeft)} يوم`
                        : d.daysLeft === 0
                          ? "مستحق اليوم"
                          : `متبقي ${d.daysLeft} يوم`}
                    </p>
                  </div>
                ))}
                <DropdownMenuSeparator />
              </>
            ) : null}

            {activationAlerts.length > 0 ? (
              <>
                <DropdownMenuLabel>خطوط تخطت 3 شهور من التفعيل</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {activationAlerts.map((line) => (
                  <div key={`act-${line.collectionName}-${line.id}`} className="px-2 py-2">
                    <p className="text-sm font-medium text-foreground">
                      {line.phone}
                      {line.name ? <span className="text-muted-foreground"> — {line.name}</span> : null}
                    </p>
                    <p className="text-xs text-warning">
                      تم التفعيل: {line.activationDate} — انتهت الـ 3 أشهر في {line.expiredSince}
                    </p>
                  </div>
                ))}
              </>
            ) : null}

            {alerts.length > 0 ? (
              <>
                <DropdownMenuLabel>خطوط وصلت للحد</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {alerts.map((line) => (
                  <div key={`lim-${line.collectionName}-${line.id}`} className="px-2 py-2">
                    <p className="text-sm font-medium text-foreground">
                      {line.phone}
                      {line.name ? <span className="text-muted-foreground"> — {line.name}</span> : null}
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {line.alerts.map((a) => (
                        <li
                          key={a.label}
                          className={cn(
                            "text-xs",
                            a.status === "exhausted" ? "text-destructive" : "text-warning",
                          )}
                        >
                          {a.label}: {a.remainder.toLocaleString("ar-EG")} / {a.cap.toLocaleString("ar-EG")}
                          {a.status === "exhausted" ? " (مستنفد)" : " (منخفض)"}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </>
            ) : null}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
