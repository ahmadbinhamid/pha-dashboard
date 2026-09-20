import { LoginCard } from "@/components/auth/LoginCard";

// Split layout: a brand panel + a form panel — the industry-standard shape
// for a B2B dashboard login (Linear, Vercel, Stripe all use this pairing).
// Brand panel goes on the left since that's the reading-order convention
// (brand first, action second) and collapses below `lg`, where LoginCard's
// own logo block (hidden at `lg` since this panel already shows it) takes
// over as the only brand mark.
//
// The panel's ink/white colors below are literal, not `bg-bg`/`text-fg`
// tokens — same exception CLAUDE.md already carves out for full-bleed dark
// overlays (modal scrims, lightboxes): this panel is meant to stay the
// "ink + accent" treatment regardless of the viewer's own light/dark
// preference, and confirmed by testing that theme tokens can't actually do
// that here — Tailwind's `bg-bg`/`text-fg` utilities resolve through a
// `--color-bg: hsl(var(--bg))` alias that's substituted once at `:root` and
// inherited as an already-resolved value, so wrapping a nested element in a
// `.dark` class (which correctly overrides the raw `--bg`/`--fg` variables)
// does NOT flow through to those utility classes — only `<html>.dark`
// (where useThemePreference actually toggles it) does. --accent is exempt
// since it's the same value in both themes, so `text-accent`/`bg-accent`
// below are the real tokens, not a literal.
export default function LoginPage() {
  return (
    <main className="grid min-h-dvh grid-cols-1 bg-bg lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-[hsl(220_20%_6%)] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(900px 560px at 12% 8%, hsl(var(--accent) / 0.38), transparent 60%), radial-gradient(760px 520px at 88% 92%, hsl(var(--accent) / 0.20), transparent 55%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 noise opacity-30" aria-hidden="true" />

        <div className="relative z-10 flex items-center gap-2.5">
          <img src="/branding/logo-mark.png" alt="" className="h-11 w-auto shrink-0" />
          <span className="text-[1.85rem] font-extrabold leading-none tracking-tight text-white">
            AutoParts<span className="text-accent">Pro</span>
          </span>
        </div>

        <div className="relative z-10 max-w-md">
          <p className="text-4xl font-bold leading-[1.15] tracking-tight text-white xl:text-[2.75rem]">
            One platform. Every marketplace.{" "}
            <span className="text-accent">Zero overselling.</span>
          </p>
          <p className="mt-5 text-base leading-relaxed text-white/55">
            Sync inventory, pricing and orders across every channel from one
            dashboard built for parts sellers.
          </p>
        </div>

        <div className="relative z-10 text-xs text-white/40">
          © {new Date().getFullYear()} Auto Parts Pro
        </div>
      </div>

      {/* Form panel — the only panel on mobile/tablet, and the only one that
          follows the viewer's own theme. */}
      <div className="relative flex min-h-dvh min-w-0 items-center justify-center overflow-y-auto px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-[max(2.5rem,env(safe-area-inset-top))] sm:px-6 lg:px-10">
        <LoginCard />
      </div>
    </main>
  );
}
