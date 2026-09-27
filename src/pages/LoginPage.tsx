import { Check } from "lucide-react";
import { LoginCard } from "@/components/auth/LoginCard";

const HIGHLIGHTS = ["Inventory", "Pricing", "Orders"];

// Split layout: brand panel (left, reading-order convention) + form panel, the standard B2B login shape.
// Below `lg`, collapses to a stacked layout: a short brand header (logo + headline only) plus a full-bleed form sheet pulled up over it, the "brand header + bottom sheet" mobile pattern. LoginCard's own logo is never shown since the page's header already carries the mark.
// The dark panel's ink/white colors are literal, not tokens — same exception CLAUDE.md carves out for full-bleed dark overlays, confirmed here because `bg-bg`/`text-fg` resolve through a `:root`-substituted alias that a nested `.dark` class can't override (only `<html>.dark` can). `--accent` is exempt since it's identical in both themes.
export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-bg lg:grid lg:grid-cols-2">
      {/* Full brand panel — lg and up. Three flex zones (logo/headline/copyright), headline as the only flex-1, keeps the logo pinned top and copyright pinned bottom at any viewport height. */}
      <div className="relative hidden overflow-hidden bg-[hsl(220_20%_6%)] lg:flex lg:flex-col lg:p-12 xl:p-20">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(900px 560px at 12% 8%, hsl(var(--accent) / 0.38), transparent 60%), radial-gradient(760px 520px at 88% 92%, hsl(var(--accent) / 0.20), transparent 55%)",
          }}
        />
        {/* Faint graph-paper grid instead of dot noise — reads more "product/dashboard", less generic marketing bg. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden="true"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 90% 70% at 30% 40%, black 40%, transparent 85%)",
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <img src="/branding/logo-mark.png" alt="" className="h-16 w-auto shrink-0" />
          <span className="text-4xl font-extrabold leading-none tracking-tight text-white">
            AutoParts<span className="text-accent">Pro</span>
          </span>
        </div>

        <div className="relative z-10 flex max-w-lg flex-1 flex-col justify-center">
          <p className="text-4xl font-extrabold leading-[1.1] tracking-tight text-white xl:text-5xl">
            One platform.
            <br />
            Every marketplace.
            <br />
            <span className="text-accent">Zero overselling.</span>
          </p>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/55">
            Sync inventory, pricing and orders across every channel from one
            dashboard built for parts sellers.
          </p>

          <div className="mt-8 flex flex-wrap gap-2.5">
            {HIGHLIGHTS.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-white/80"
              >
                <Check className="h-3.5 w-3.5 text-accent" />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-white/40">
          © {new Date().getFullYear()} Auto Parts Pro
        </div>
      </div>

      {/* Compact brand header — below `lg` only. Same dark/grid treatment, logo + headline only; sized to ~30% of a phone viewport so the form stays above the fold. */}
      <div className="relative overflow-hidden bg-[hsl(220_20%_6%)] px-6 pb-10 pt-[max(2rem,env(safe-area-inset-top))] lg:hidden">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background: "radial-gradient(600px 360px at 15% 0%, hsl(var(--accent) / 0.35), transparent 65%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden="true"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(ellipse 100% 100% at 20% 0%, black 40%, transparent 90%)",
          }}
        />

        <div className="relative z-10 mb-6 flex items-center gap-2.5">
          <img src="/branding/logo-mark.png" alt="" className="h-10 w-auto shrink-0" />
          <span className="text-2xl font-extrabold leading-none tracking-tight text-white">
            AutoParts<span className="text-accent">Pro</span>
          </span>
        </div>
        <p className="relative z-10 text-4xl font-extrabold leading-[1.1] tracking-tight text-white">
          One platform.
          <br />
          Every marketplace.
          <br />
          <span className="text-accent">Zero overselling.</span>
        </p>
      </div>

      {/* Form. Below `lg` a full-bleed sheet pulled up over the header (rounded top corners on LoginCard's Card); at `lg`+ a centered floating card. */}
      <div className="relative -mt-6 min-w-0 lg:mt-0 lg:flex lg:min-h-dvh lg:items-center lg:justify-center lg:overflow-y-auto lg:px-10 lg:py-10">
        <LoginCard />
      </div>
    </main>
  );
}
