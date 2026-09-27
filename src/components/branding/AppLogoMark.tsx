import { cn } from "@/utils/cn";

export const APP_NAME = "Auto Parts Pro";

// Product-level mark (distinct from tenant logos, see TenantLogo) for pre-login screens only; favicon.png is the separate icon-only crop for the tab icon.
// Gear artwork is a fixed-color raster (public/branding/logo-mark.png) with an opaque white backdrop so it stays legible in dark mode; "AutoParts"/"Pro" stay real text so they still invert with the theme.
export function AppLogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-10 items-center gap-2.5", className)}>
      <img src="/branding/logo-mark.png" alt="" className="h-full w-auto shrink-0" />
      <span className="text-[1.85rem] font-extrabold leading-none tracking-tight text-fg">
        AutoParts<span className="text-accent">Pro</span>
      </span>
    </div>
  );
}
