
import { Suspense } from "react";
import { cn } from "@/utils/cn";
import { useOrgSettings } from "@/context";
import { TenantLogo } from "@/components/branding/TenantLogo";
import { APP_NAME } from "@/components/branding/AppLogoMark";
import { NavItemsList } from "@/components/shell/NavItemsList";

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const { settings } = useOrgSettings();

  return (
    <div className="flex h-dvh max-h-dvh flex-col border-r border-border bg-card">
      {/* Logo / brand — height matches Topbar so the border seam lines up */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-3",
          collapsed && "justify-center px-0",
        )}
      >
        <div className="shrink-0 overflow-hidden rounded-xs ring-1 ring-[hsl(var(--accent)/0.28)]">
          <TenantLogo
            logoUrl={settings.logoUrl}
            name={settings.storeName}
            sizeClass={collapsed ? "h-6" : "h-7"}
            maxWidthClass={collapsed ? "max-w-6" : "max-w-7"}
            priority
          />
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold leading-tight tracking-tight text-fg">
              {settings.storeName || APP_NAME}
            </div>
            <div className="truncate text-[10.5px] text-fg/45">{APP_NAME}</div>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-3">
        <Suspense fallback={null}>
          <NavItemsList collapsed={collapsed} />
        </Suspense>
      </nav>
    </div>
  );
}
