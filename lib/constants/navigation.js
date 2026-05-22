import {
  LayoutDashboard,
  Wallet,
  Smartphone,
  BarChart3,
  Settings,
  HandCoins,
} from "lucide-react";

export const mainNavItems = [
  { href: "/", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/lines", label: "الخطوط", icon: Smartphone },
  { href: "/reports", label: "التقارير", icon: BarChart3 },
  { href: "/debts", label: "الديون", icon: HandCoins },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];
