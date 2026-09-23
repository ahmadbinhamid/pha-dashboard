import { Store } from "lucide-react";
import { getChannelLogo } from "@/components/channels/channelLogos";

// Identity-only chip for a sales channel. A recognized channel (eBay,
// Google, or "storefront" — the tenant's own site) shows its real logo; an
// initials-on-a-categorical-color chip is the fallback for anything else
// (a future adapter this hasn't been taught about yet). Same principle as
// ActiveChannelsCard.tsx's own inline avatar (dashboard): identity gets a
// categorical color, health gets a separate semantic-token dot/badge, and
// the two never share one element. Kept as its own component rather than
// reusing that one directly — its rounded-full treatment is Products-page
// styling, not something to force onto the dashboard's own rounded-xl chip
// (or vice-versa); both call into getChannelLogo() for the actual logo
// though, so eBay/Google never get drawn twice.
//
// Deliberately carries no status meaning. Mixing "which channel" and "is it
// healthy" into one colored dot was exactly what made the Products page's
// channel status confusing: the same visual meant one thing collapsed and a
// different thing once expanded. This chip only ever answers "which
// channel"; color here never implies health.
const AVATAR_COLOR_VARS = [
  "var(--color-cat-1)",
  "var(--color-cat-2)",
  "var(--color-cat-3)",
  "var(--color-cat-4)",
  "var(--color-cat-5)",
  "var(--color-cat-6)",
];

export function channelAvatarColor(index: number) {
  return AVATAR_COLOR_VARS[index % AVATAR_COLOR_VARS.length];
}

export function channelInitials(name: string) {
  const words = name.trim().split(/\s+/);
  return words.length === 1 ? words[0].slice(0, 2).toUpperCase() : (words[0][0] + words[1][0]).toUpperCase();
}

export function ChannelAvatar({
  name,
  index,
  size = "sm",
  channelKey,
  // Tenant's own uploaded logo (Branding settings) — only meaningful when
  // channelKey === "storefront", since that's the one "channel" that's the
  // tenant's own brand rather than a third party's.
  logoUrl,
}: {
  name: string;
  /** Position among the channels being shown together — picks the fallback color. */
  index: number;
  size?: "sm" | "md";
  /** e.g. "ebay" | "google" | "storefront" — resolves to a real logo instea... */
  channelKey?: string;
  logoUrl?: string | null;
}) {
  const dimension = size === "sm" ? "h-5 w-5" : "h-8 w-8";
  const iconDimension = size === "sm" ? "h-3 w-3" : "h-4.5 w-4.5";

  const BrandLogo = channelKey ? getChannelLogo(channelKey) : null;
  const isStorefront = channelKey === "storefront";

  if (BrandLogo || isStorefront) {
    return (
      <span
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-2 ring-1 ring-inset ring-border ${dimension}`}
        aria-hidden="true"
      >
        {BrandLogo ? (
          <BrandLogo className={iconDimension} />
        ) : logoUrl ? (
          <img src={logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Store className={`${iconDimension} text-fg/50`} />
        )}
      </span>
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${dimension} ${size === "sm" ? "text-[9px]" : "text-xs"}`}
      style={{ backgroundColor: channelAvatarColor(index) }}
      aria-hidden="true"
    >
      {channelInitials(name)}
    </span>
  );
}
