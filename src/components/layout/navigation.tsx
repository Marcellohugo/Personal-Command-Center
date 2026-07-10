"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, ClipboardCheck, LayoutDashboard, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard
  },
  {
    href: "/schedules",
    label: "Jadwal",
    icon: CalendarDays
  },
  {
    href: "/expenses",
    label: "Pengeluaran",
    icon: WalletCards
  },
  {
    href: "/habits",
    label: "Habit",
    icon: ClipboardCheck
  }
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition",
              active ? "bg-ink text-white" : "text-ink/70 hover:bg-white hover:text-ink"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
