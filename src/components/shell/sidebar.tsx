"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavItemActive } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { useOrgSettings } from "@/components/settings/org-settings-provider";
import { PartsHubLogoImage } from "@/components/branding/parts-hub-logo-image";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";
import { erpNavIconClass, erpNavRowClass } from "@/lib/erp-shell-nav";

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const { settings } = useOrgSettings();

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col border-r border-border bg-card/55">
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-4",
          collapsed ? "flex-col justify-center gap-2.5 py-5" : "sm:px-4",
        )}
      >
        <div
          className={cn(
            "shrink-0 rounded-xl bg-black p-1.5 shadow-sm ring-1 ring-[hsl(var(--accent)/0.28)]",
            collapsed && "p-1",
          )}
        >
          <PartsHubLogoImage
            sizeClass={collapsed ? "h-9" : "h-12"}
            maxWidthClass={collapsed ? "max-w-9" : "max-w-12"}
            className={collapsed ? "object-center" : undefined}
            priority
          />
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold leading-tight tracking-tight text-fg">
              {settings.storeName}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-fg/50">Parts Hub ERP</div>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-1">
        <div
          className={cn(
            "mb-2 px-2.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-fg/40",
            collapsed && "sr-only",
          )}
        >
          Menu
        </div>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isNavItemActive(item.href, pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={item.label}
                  className={erpNavRowClass(active, collapsed)}
                >
                  <span className={erpNavIconClass(active)} aria-hidden="true">
                    {item.icon({ className: "h-[17px] w-[17px]" })}
                  </span>
                  {!collapsed ? <span className="min-w-0 truncate pr-1">{item.label}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border/70 p-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-9 w-full text-fg/55 hover:bg-bg-2/80 hover:text-fg",
            collapsed && "px-0",
          )}
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <Icons.ChevronRight /> : <Icons.ChevronLeft />}
          {!collapsed ? <span className="ml-2 text-xs font-medium">Collapse</span> : null}
        </Button>
      </div>
    </div>
  );
}
