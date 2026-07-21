
import { startTransition, useEffect, useMemo, useState } from "react";
import { cn } from "@/utils/cn";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { MobileSidebar } from "@/components/shell/MobileSidebar";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const SIDEBAR_COLLAPSED_KEY = "pha-erp-sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (v === "1") startTransition(() => setSidebarCollapsed(true));
    } catch { /* ignore */ }
  }, []);

  const toggleSidebar = useMemo(
    () => () => {
      setSidebarCollapsed((prev) => {
        const next = !prev;
        try { localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0"); } catch { /* ignore */ }
        return next;
      });
    },
    [],
  );

  const close = useMemo(() => () => setMobileOpen(false), []);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-bg">
      <div className="pointer-events-none absolute inset-0 noise" aria-hidden="true" />

      {/* Sidebar — fixed, never scrolls */}
      <aside
        className={cn(
          "hidden h-dvh shrink-0 transition-[width] duration-200 ease-out lg:block print:hidden",
          sidebarCollapsed ? "w-18" : "w-65",
        )}
      >
        <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />
      </aside>

      <div className="print:hidden">
        <MobileSidebar open={mobileOpen} onClose={close} />
      </div>

      {/*
        Outer column: NOT overflow-y-auto — so the toggle button (which uses
        -translate-x-1/2 to sit on the sidebar border) is never clipped.
        Only the inner content div scrolls.
      */}
      <div className="relative flex h-dvh min-w-0 flex-1 flex-col">
        {/* Toggle button — lives here so overflow-y-auto can't clip it */}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "absolute left-0 top-5 z-30 hidden -translate-x-1/2 lg:flex print:hidden",
            "h-6 w-6 items-center justify-center",
            "rounded-xs border border-border bg-bg shadow-sm",
            "text-fg/40 transition hover:bg-bg-2 hover:text-fg",
          )}
        >
          {sidebarCollapsed
            ? <PanelLeftOpen className="h-3.5 w-3.5" />
            : <PanelLeftClose className="h-3.5 w-3.5" />
          }
        </button>

        <div className="print:hidden">
          <Topbar onOpenMobile={() => setMobileOpen(true)} />
        </div>

        {/* Inner scroll container — only this scrolls */}
        <div className="min-h-0 flex-1 overflow-y-auto print:h-auto print:overflow-visible">
          <main
            className={cn(
              "w-full min-w-0 px-4 py-section sm:px-6 lg:px-10",
              "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
              "print:px-0 print:py-0",
            )}
          >
            <div className="w-full min-w-0">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
