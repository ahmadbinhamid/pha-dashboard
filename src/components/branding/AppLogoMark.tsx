import { cn } from "@/utils/cn";

export const APP_NAME = "Auto Parts Pro";

// Product-level mark (distinct from any tenant's own logo — see TenantLogo)
// used only where no tenant is known yet: the pre-login screens (Login,
// Register, Forgot/Reset Password). The matching icon-only crop lives at
// public/favicon.svg for the browser tab/app icon — a wordmark shrunk to
// 16px is unreadable, so that one deliberately isn't this component.
//
// Drawn as inline SVG (not an <img>) so it stays crisp at any size and can
// use the app's own design tokens instead of baked-in pixels: the gear +
// "Pro" use var(--color-accent) (the same orange as every button/link in the
// app, identical value in both light and dark mode), and "AutoParts" +
// the growth-arrow glyph use currentColor, so they invert automatically with
// dark mode the same way an icon or a text label would — inherited from
// whatever text color class the caller wraps this in (defaults to text-fg).
//
// Natural aspect ratio is ~3.8:1 (wide wordmark lockup) — size with a height
// + w-auto, never a fixed square box, or the wordmark gets squashed/cropped.
export function AppLogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 378 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={APP_NAME}
      className={cn("h-10 w-auto text-fg", className)}
    >
      <path
        fillRule="evenodd"
        fill="var(--color-accent)"
        d="M 92.94 59.60 L 79.78 82.39 L 67.00 79.44 L 63.16 91.99 L 36.84 91.99 L 33.00 79.44 L 20.22 82.39 L 7.06 59.60 L 16.00 50.00 L 7.06 40.40 L 20.22 17.61 L 33.00 20.56 L 36.84 8.01 L 63.16 8.01 L 67.00 20.56 L 79.78 17.61 L 92.94 40.40 L 84.00 50.00 Z
           M 25.00 50.00 A 25.00 25.00 0 1 0 75.00 50.00 A 25.00 25.00 0 1 0 25.00 50.00 Z"
      />
      {/* Three ascending bars, sized to actually fill the gear's hole (not
          a small cluster in one corner of it), with a bold trend line that
          starts at a small data point, climbs alongside each bar's top, and
          breaks past the gear's rim into a clean arrowhead — the slight
          overshoot past the hole is deliberate, it's what reads as
          "breaking out/trending up" instead of a diagram boxed inside a
          circle. The arrowhead is a triangle computed along the line's own
          final direction (not hand-placed), so it actually points the way
          the line is going. */}
      <rect x="31" y="51" width="7" height="12" rx="1.4" fill="currentColor" />
      <rect x="41" y="43" width="8" height="20" rx="1.4" fill="currentColor" />
      <rect x="52" y="35" width="8" height="28" rx="1.4" fill="currentColor" />
      <circle cx="31" cy="62" r="3.2" fill="none" stroke="currentColor" strokeWidth="3" />
      <path
        d="M 31 62 L 37 52 L 46 40 L 56 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M 59.52 23.77 L 58.46 31.61 L 52.01 26.23 Z" fill="currentColor" />
      <text
        x="98"
        y="65"
        fontFamily="ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize="42"
        fontWeight="800"
        letterSpacing="-0.5"
      >
        <tspan fill="currentColor">AutoParts</tspan>
        <tspan fill="var(--color-accent)">Pro</tspan>
      </text>
    </svg>
  );
}
