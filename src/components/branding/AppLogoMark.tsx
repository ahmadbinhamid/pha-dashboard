import { useId } from "react";
import { cn } from "@/utils/cn";

export const APP_NAME = "Auto Parts Pro";

// Product-level mark (distinct from any tenant's own logo — see TenantLogo)
// used only where no tenant is known yet, i.e. the pre-login screen and the
// browser tab (see /public/favicon.svg, which mirrors this same mark).
export function AppLogoMark({ className }: { className?: string }) {
  // Gradient ids must be unique per instance — two renders on the same page
  // (unlikely today, but cheap to guard) would otherwise collide since SVG
  // gradient refs are resolved against the whole document, not scoped to
  // the <svg> they're defined in.
  const uid = useId();
  const gradient1 = `app-logo-g1-${uid}`;
  const gradient2 = `app-logo-g2-${uid}`;

  return (
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className={cn("h-8 w-8 rounded-2xl", className)}>
      <defs>
        <linearGradient id={gradient1} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4F46E5" />
          <stop offset="0.5" stopColor="#2563EB" />
          <stop offset="1" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id={gradient2} x1="16" y1="8" x2="32" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#93C5FD" />
          <stop offset="1" stopColor="#60A5FA" />
        </linearGradient>
      </defs>
      <path d="M24 6 L38 34 H31.5 L28.5 28 H19.5 L16.5 34 H10 Z" fill={`url(#${gradient1})`} />
      <path d="M20.8 24.5 H27.2 L24 16 Z" fill="white" />
      <path d="M12 37 Q24 42 36 37" stroke={`url(#${gradient2})`} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <circle cx="38" cy="10" r="3.5" fill="none" stroke="#60A5FA" strokeWidth="1.5" />
      <circle cx="38" cy="10" r="1.2" fill="#60A5FA" />
    </svg>
  );
}
