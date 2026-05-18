"use client";

import { Suspense } from "react";
import { cn } from "@/lib/cn";
import { Icons } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { useOrgSettings } from "@/components/settings/org-settings-provider";
import { PartsHubLogoImage } from "@/components/branding/parts-hub-logo-image";
import { NavItemsList } from "@/components/shell/nav-items-list";

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings } = useOrgSettings();

  return (
    <div className={cn("fixed inset-0 z-40 lg:hidden", open ? "" : "pointer-events-none")}>
      <div
        className={cn(
          "absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={cn(
          "absolute left-0 top-0 flex h-dvh max-h-dvh w-[min(88vw,300px)] flex-col rounded-r-2xl border-r border-border bg-card shadow-2xl transition-transform duration-200 ease-out",
          "pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0px,env(safe-area-inset-left))]",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="shrink-0 rounded-xl bg-black p-1.5 ring-1 ring-[hsl(var(--accent)/0.28)]">
              <PartsHubLogoImage sizeClass="h-11" maxWidthClass="max-w-11" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold leading-tight tracking-tight">{settings.storeName}</div>
              <div className="truncate text-[11px] text-fg/50">Parts Hub ERP</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-9 w-9 shrink-0 p-0" onClick={onClose} aria-label="Close menu">
            <Icons.X />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <div className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-fg/40">Menu</div>
          <Suspense fallback={null}>
            <NavItemsList onItemClick={onClose} />
          </Suspense>
        </nav>
      </div>
    </div>
  );
}
