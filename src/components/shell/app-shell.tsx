"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { MobileSidebar } from "@/components/shell/mobile-sidebar";

const SIDEBAR_COLLAPSED_KEY = "pha-erp-sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (v === "1") startTransition(() => setSidebarCollapsed(true));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebar = useMemo(
    () => () => {
      setSidebarCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [],
  );

  const close = useMemo(() => () => setMobileOpen(false), []);

  return (
    <div className="min-h-[100dvh] bg-bg">
      <div className="pointer-events-none absolute inset-0 noise" aria-hidden="true" />

      <div className="relative flex min-h-[100dvh] w-full">
        <aside
          className={cn(
            "hidden shrink-0 overflow-hidden transition-[width] duration-200 ease-out lg:block",
            sidebarCollapsed ? "w-[72px]" : "w-[260px]",
          )}
        >
          <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />
        </aside>

        <MobileSidebar open={mobileOpen} onClose={close} />

        <div className="min-w-0 flex-1">
          <Topbar onOpenMobile={() => setMobileOpen(true)} />
          <main
            className={cn(
              "w-full min-w-0 px-4 py-6 sm:px-6 lg:px-10",
              "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
            )}
          >
            <div className="w-full min-w-0">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
