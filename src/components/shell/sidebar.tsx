
import { Suspense } from "react";
import { cn } from "@/utils/cn";
import { useOrgSettings } from "@/context";
import { PartsHubLogoImage } from "@/components/branding/parts-hub-logo-image";
import { NavItemsList } from "@/components/shell/nav-items-list";

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const { settings } = useOrgSettings();

  return (
    <div className="flex h-dvh max-h-dvh flex-col border-r border-border bg-card/55">
      {/* Logo / brand */}
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-4",
          collapsed ? "flex-col justify-center gap-2.5 py-5" : "sm:px-4",
        )}
      >
        <div
          className={cn(
            "shrink-0 rounded-xs bg-black p-1.5 shadow-sm ring-1 ring-[hsl(var(--accent)/0.28)]",
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
        <Suspense fallback={null}>
          <NavItemsList collapsed={collapsed} />
        </Suspense>
      </nav>
    </div>
  );
}
