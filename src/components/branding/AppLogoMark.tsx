import { cn } from "@/utils/cn";

export const APP_NAME = "Auto Parts Pro";

// Product-level mark (distinct from any tenant's own logo — see TenantLogo)
// used only where no tenant is known yet: the pre-login screens (Login,
// Register, Forgot/Reset Password). The matching icon-only crop is
// public/favicon.png for the browser tab/app icon — a wordmark shrunk to
// 16px is unreadable, so that one deliberately isn't this component.
//
// The gear mark is the supplied brand artwork (public/branding/logo-mark.png)
// — a fixed-color raster, not a currentColor SVG — so unlike the previous
// hand-drawn version it can't invert with the app theme. Its white circle
// backdrop is kept opaque (only the square canvas around the gear was cut to
// transparent) specifically so the mark still reads correctly on a dark
// background: without that white backing, the artwork's black bars would be
// nearly invisible in dark mode. "AutoParts"/"Pro" stay real text in
// currentColor/var(--color-accent) so the wordmark keeps inverting with
// dark mode same as before.
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
