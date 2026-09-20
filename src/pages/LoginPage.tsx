import { Check } from "lucide-react";
import { LoginCard } from "@/components/auth/LoginCard";

const HIGHLIGHTS = ["Inventory", "Pricing", "Orders"];

// Split layout: a brand panel + a form panel — the industry-standard shape
// for a B2B dashboard login (Linear, Vercel, Stripe all use this pairing).
// Brand panel goes on the left since that's the reading-order convention
// (brand first, action second).
//
// Below `lg` there isn't room for a side-by-side split, so it collapses to
// a stacked layout instead of just hiding the brand panel outright: a
// short version of it stays as a header (logo + headline only — the
// subtext/pills/copyright are cut for space), and the form becomes a
// full-bleed sheet with rounded top corners pulled up slightly over that
// header, the same "brand header + bottom sheet" shape most B2B apps use
// on mobile rather than shrinking the desktop card down. LoginCard's own
// logo block is never shown — on every screen size, some version of this
// page's own brand header already carries the mark, so a second one inside
// the card would be a duplicate.
//
// The dark panel's ink/white colors below are literal, not `bg-bg`/`text-fg`
// tokens — same exception CLAUDE.md already carves out for full-bleed dark
// overlays (modal scrims, lightboxes): it's meant to stay the "ink + accent"
// treatment regardless of the viewer's own light/dark preference, and
// confirmed by testing that theme tokens can't actually do that here —
// Tailwind's `bg-bg`/`text-fg` utilities resolve through a
// `--color-bg: hsl(var(--bg))` alias that's substituted once at `:root` and
// inherited as an already-resolved value, so wrapping a nested element in a
// `.dark` class (which correctly overrides the raw `--bg`/`--fg` variables)
// does NOT flow through to those utility classes — only `<html>.dark`
// (where useThemePreference actually toggles it) does. --accent is exempt
// since it's the same value in both themes, so `text-accent`/`bg-accent`
// below are the real tokens, not a literal.
export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-bg lg:grid lg:grid-cols-2">
      {/* Full brand panel — lg and up only. Three flex zones (logo / headline
          block / copyright) instead of one vertically-centered group with an
          absolutely-positioned copyright: that combination looked fine at
          "normal" viewport heights, but on a tall one the centered group
          floats in the upper half with a huge dead gap before the copyright,
          since the copyright's offset was fixed rather than tied to the
          panel's actual height. A flex column with the headline block as the
          only flex-1 (self-centering within whatever space is actually left)
          keeps the logo pinned near the top and the copyright pinned to the
          bottom at any height. */}
      <div className="relative hidden overflow-hidden bg-[hsl(220_20%_6%)] lg:flex lg:flex-col lg:p-12 xl:p-20">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(900px 560px at 12% 8%, hsl(var(--accent) / 0.38), transparent 60%), radial-gradient(760px 520px at 88% 92%, hsl(var(--accent) / 0.20), transparent 55%)",
          }}
        />
        {/* Faint graph-paper grid instead of the dot noise texture — reads as
            more "product/dashboard" and less like a generic marketing bg. */}
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

      {/* Compact brand header — below `lg` only. Same dark/grid treatment,
          logo + headline only (no subtext/pills/copyright — there isn't
          room, and the sheet below needs the space more). Sized to land
          around ~30% of a typical phone viewport — big enough for the logo
          and headline to actually read, without pushing the form itself
          below the fold. */}
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

      {/* Form. Below `lg` this is a full-bleed sheet pulled up over the
          header above (rounded top corners on LoginCard's own Card — see
          there); at `lg` and up it's the usual centered floating card. */}
      <div className="relative -mt-6 min-w-0 lg:mt-0 lg:flex lg:min-h-dvh lg:items-center lg:justify-center lg:overflow-y-auto lg:px-10 lg:py-10">
        <LoginCard />
      </div>
    </main>
  );
}
