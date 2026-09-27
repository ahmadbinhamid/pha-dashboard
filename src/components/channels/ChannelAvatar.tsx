import { Store } from "lucide-react";
import { getChannelLogo } from "@/components/channels/channelLogos";
import { CATEGORICAL_COLOR_VARS as AVATAR_COLOR_VARS } from "@/config/categoricalColors";

// Identity-only channel chip (logo or initials); color never implies health.
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
  // Tenant logo; only used when channelKey === "storefront" (tenant's own brand).
  logoUrl,
}: {
  name: string;
  /** Position among shown channels; picks the fallback color. */
  index: number;
  size?: "sm" | "md";
  /** e.g. "ebay" | "google" | "storefront"; resolves to a real logo. */
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
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${dimension} ${size === "sm" ? "text-4xs" : "text-xs"}`}
      style={{ backgroundColor: channelAvatarColor(index) }}
      aria-hidden="true"
    >
      {channelInitials(name)}
    </span>
  );
}
