// Real brand marks, shared by every place that shows "which channel is
// this" — the Integrations catalogue, ChannelAvatar (Products page channel
// rows, the dashboard's Sales Channels card), and the Products page's
// channel filter pills. A generic lucide glyph (ShoppingBag/ShoppingCart) or
// a plain initials chip doesn't actually identify eBay or Google at a glance
// the way their own logo does. Path data is Simple Icons' eBay/Google
// glyphs (CC0 — public domain, no attribution required), reproduced locally
// rather than pulling in the whole simple-icons package for two icons.
// Rendered in each brand's own color (hardcoded, not a theme token) — a
// partner's logo should never be recolored to match our own accent, the one
// place in this app a literal hex is the right call over a CSS variable.

export function EbayLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#E53238" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <title>eBay</title>
      <path d="M6.056 12.132v-4.92h1.2v3.026c.59-.703 1.402-.906 2.202-.906 1.34 0 2.828.904 2.828 2.855 0 .233-.015.457-.06.668.24-.953 1.274-1.305 2.896-1.344.51-.018 1.095-.018 1.56-.018v-.135c0-.885-.556-1.244-1.53-1.244-.72 0-1.245.3-1.305.81h-1.275c.136-1.29 1.5-1.62 2.686-1.62 1.064 0 1.995.27 2.415 1.02l-.436-.84h1.41l2.055 4.125 2.055-4.126H24l-3.72 7.305h-1.346l1.07-2.04-2.33-4.38c.13.255.2.555.2.93v2.46c0 .346.01.69.04 1.005H16.8a6.543 6.543 0 01-.046-.765c-.603.734-1.32.96-2.32.96-1.48 0-2.272-.78-2.272-1.695 0-.15.015-.284.037-.405-.3 1.246-1.36 2.086-2.767 2.086-.87 0-1.694-.315-2.2-.93 0 .24-.015.494-.04.734h-1.18c.02-.39.04-.855.04-1.245v-1.05h-4.83c.065 1.095.818 1.74 1.853 1.74.718 0 1.355-.3 1.568-.93h1.24c-.24 1.29-1.61 1.725-2.79 1.725C.95 15.009 0 13.822 0 12.232c0-1.754.982-2.91 3.116-2.91 1.688 0 2.93.886 2.94 2.806v.005zm9.137.183c-1.095.034-1.77.233-1.77.95 0 .465.36.97 1.305.97 1.26 0 1.935-.69 1.935-1.814v-.13c-.45 0-.99.006-1.484.022h.012zm-6.06 1.875c1.11 0 1.876-.806 1.876-2.02s-.768-2.02-1.893-2.02c-1.11 0-1.89.806-1.89 2.02s.765 2.02 1.875 2.02h.03zm-4.35-2.514c-.044-1.125-.854-1.546-1.725-1.546-.944 0-1.694.474-1.815 1.546z" />
    </svg>
  );
}

export function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#4285F4" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <title>Google</title>
      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
    </svg>
  );
}

export type BrandLogoComponent = (props: { className?: string }) => React.ReactNode;

const CHANNEL_LOGOS: Record<string, BrandLogoComponent> = {
  ebay: (p) => <EbayLogo {...p} />,
  google: (p) => <GoogleLogo {...p} />,
};

// Storefront is deliberately excluded — it isn't a third-party brand with a
// fixed mark, it's the tenant's OWN site, so its "logo" is whatever they've
// uploaded (or nothing) rather than something this lookup can resolve on its
// own. Callers handle channelKey === "storefront" themselves (tenant's
// logo_url, else a generic Store icon) — see ChannelAvatar.tsx and
// ActiveChannelsCard.tsx.
export function getChannelLogo(channelKey: string): BrandLogoComponent | null {
  return CHANNEL_LOGOS[channelKey] ?? null;
}
