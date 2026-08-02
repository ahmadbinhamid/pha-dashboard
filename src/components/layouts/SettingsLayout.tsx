import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { usePathname } from "@/hooks";
import { SettingsHeaderActionsProvider } from "@/context/settingsHeaderActions";
import { SETTINGS_NAV_SECTIONS, isSettingsNavActive } from "@/config/settingsNav";
import { cn } from "@/utils/cn";

/**
 * Settings renders as a route-driven bottom sheet above the app: `/settings/*`
 * URLs are unchanged, this layout just presents them in a slide-up overlay
 * with its own nav and a close button. `from` is captured once, on the entry
 * navigation into `/settings/*` (see the Settings button in Topbar), so switching between
 * settings tabs afterwards doesn't affect where closing lands — otherwise a
 * history-relative close (`navigate(-1)`) would just step back one settings
 * tab at a time instead of leaving the sheet.
 */
export function SettingsLayout() {
  const pathname = usePathname();
  const location = useLocation();
  const navigate = useNavigate();

  const [entryFrom] = useState(() => (location.state as { from?: string } | null)?.from ?? null);
  const [headerActionsEl, setHeaderActionsEl] = useState<HTMLDivElement | null>(null);

  const close = useCallback(() => navigate(entryFrom || "/dashboard"), [navigate, entryFrom]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const SidebarContent = () => (
    <div className="p-3">
      {SETTINGS_NAV_SECTIONS.map((section) => (
        <div key={section.label} className="mb-5 space-y-0.5">
          <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg/40">
            {section.label}
          </p>
          {section.items.map((item) => {
            const active = isSettingsNavActive(item.href, pathname);
            return (
              <Button
                key={item.href}
                variant="ghost"
                onClick={() => navigate(item.href)}
                className={cn(
                  "relative h-auto w-full justify-start gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium",
                  active ? "bg-accent/10 text-accent hover:bg-accent/10" : "text-fg/70 hover:bg-muted/60 hover:text-fg",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-accent transition-opacity",
                    active ? "opacity-100" : "opacity-0",
                  )}
                />
                <span className={cn("grid h-4.5 w-4.5 shrink-0 place-items-center", active ? "text-accent" : "text-fg/45")}>
                  {item.icon({ className: "h-[15px] w-[15px]" })}
                </span>
                <span className="min-w-0 truncate">{item.label}</span>
              </Button>
            );
          })}
        </div>
      ))}
    </div>
  );

  return createPortal(
    <>
      <div aria-hidden onClick={close} className="fixed inset-0 z-50 animate-in fade-in bg-black/30 duration-200" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className={cn(
          "fixed inset-x-0 bottom-0 top-3 z-50 flex flex-col overflow-hidden sm:top-6",
          "rounded-t-xl border-x border-t border-border bg-bg shadow-2xl",
          "animate-in slide-in-from-bottom-8 fade-in duration-300",
        )}
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
          <h1 className="text-lg font-semibold text-fg">Settings</h1>
          <div className="flex items-center gap-3">
            <div ref={setHeaderActionsEl} className="flex items-center gap-3" />
            <Button variant="ghost" size="icon" onClick={close} aria-label="Close settings">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border bg-card lg:block">
            <SidebarContent />
          </aside>

          <div className="w-full border-b border-border bg-card lg:hidden">
            <div className="flex items-center gap-1 overflow-x-auto px-3 py-2">
              {SETTINGS_NAV_SECTIONS.flatMap((section) =>
                section.items.map((item) => {
                  const active = isSettingsNavActive(item.href, pathname);
                  return (
                    <Button
                      key={item.href}
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(item.href)}
                      className={cn(
                        "shrink-0 gap-1.5 whitespace-nowrap",
                        active ? "bg-accent/10 text-accent hover:bg-accent/10" : "text-fg/70",
                      )}
                    >
                      {item.icon({ className: "h-4 w-4" })}
                      {item.label}
                    </Button>
                  );
                }),
              )}
            </div>
          </div>

          <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <SettingsHeaderActionsProvider value={headerActionsEl}>
              <Outlet />
            </SettingsHeaderActionsProvider>
          </main>
        </div>
      </div>
    </>,
    document.body,
  );
}
