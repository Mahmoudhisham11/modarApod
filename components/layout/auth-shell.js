import { CircleDollarSign } from "lucide-react";

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">{label}</div>
    </div>
  );
}

export function AuthShell({ title, subtitle, children, notice }) {
  return (
    <div className="grid min-h-screen w-full bg-background lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(to_left,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="relative flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <CircleDollarSign className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">مدار</span>
            <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/60">
              إدارة محلات الدفع
            </span>
          </div>
        </div>

        <div className="relative max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-tight">
            عمليات يومية، فروع، خطوط، وتقارير في منصة واحدة.
          </h2>
          <div className="grid grid-cols-3 gap-4 border-t border-sidebar-border/50 pt-4">
            <Stat label="الفروع" value="—" />
            <Stat label="العمليات" value="—" />
            <Stat label="الخطوط" value="—" />
          </div>
        </div>

        <p className="relative text-xs text-sidebar-foreground/50">© {new Date().getFullYear()} مدار</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <CircleDollarSign className="h-4 w-4" />
            </div>
            <span className="font-semibold">مدار</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          {notice ? (
            <p className="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {notice}
            </p>
          ) : null}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
