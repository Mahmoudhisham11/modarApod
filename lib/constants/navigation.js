import {
  LayoutDashboard,
  Wallet,
  Smartphone,
  BarChart3,
  Settings,
} from "lucide-react";

export const mainNavItems = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/operations", label: "العمليات", icon: Wallet },
  { href: "/lines", label: "الخطوط", icon: Smartphone },
  { href: "/reports", label: "التقارير", icon: BarChart3 },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];
