import { useId } from "react";

// Real brand marks, shared by every place that shows "which channel is
// this" — the Integrations catalogue, ChannelAvatar (Products page channel
// rows, the dashboard's Sales Channels card), and the Products page's
// channel filter pills. A generic lucide glyph (ShoppingBag/ShoppingCart) or
// a plain initials chip doesn't actually identify eBay or Google at a glance
// the way their own logo does. Official brand assets, reproduced locally
// rather than fetched at runtime. Rendered in each brand's own color
// (hardcoded, not a theme token) — a partner's logo should never be
// recolored to match our own accent, the one place in this app a literal
// hex is the right call over a CSS variable.

// eBay's mark is a wordmark, not a square glyph (native aspect ratio is
// ~2.5:1) — every caller sizes this into a square slot (ChannelAvatar's
// round chip, the filter pills), so at those sizes it renders "contained"
// (SVG's default preserveAspectRatio), i.e. centered and letterboxed rather
// than stretched. That's the correct tradeoff: a slightly smaller mark reads
// far better than a distorted one.
export function EbayLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0.1 0.1 299.8 120.125" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <title>eBay</title>
      <path d="M38.867 26.309C17.721 26.309.1 35.279.1 62.345c0 21.442 11.849 34.944 39.312 34.944 32.326 0 34.398-21.294 34.398-21.294H58.147s-3.358 11.466-19.69 11.466c-13.302 0-22.869-8.986-22.869-21.58h59.861v-7.904c0-12.46-7.91-31.668-36.582-31.668zM38.32 36.41c12.662 0 21.294 7.757 21.294 19.383h-43.68c0-12.343 11.268-19.383 22.386-19.383z" fill="#e53238" />
      <path d="M75.438.1v83.597c0 4.745-.339 11.408-.339 11.408h14.939s.537-4.785.537-9.159c0 0 7.381 11.548 27.451 11.548 21.134 0 35.49-14.674 35.49-35.695 0-19.557-13.186-35.286-35.456-35.286-20.854 0-27.334 11.261-27.334 11.261V.1H75.438zm38.766 36.753c14.352 0 23.479 10.652 23.479 24.946 0 15.328-10.541 25.355-23.376 25.355-15.318 0-23.581-11.961-23.581-25.219 0-12.354 7.414-25.082 23.478-25.082z" fill="#0064d2" />
      <path d="M190.645 26.309c-31.812 0-33.852 17.418-33.852 20.202h15.834s.83-10.169 16.926-10.169c10.459 0 18.564 4.788 18.564 13.991v3.276h-18.564c-24.645 0-37.674 7.21-37.674 21.841 0 14.398 12.038 22.232 28.307 22.232 22.172 0 29.314-12.251 29.314-12.251 0 4.873.375 9.675.375 9.675h14.076s-.545-5.952-.545-9.76V52.432c0-21.582-17.408-26.123-32.761-26.123zm17.472 37.128v4.368c0 5.697-3.516 19.861-24.212 19.861-11.333 0-16.192-5.656-16.192-12.217 0-11.935 16.363-12.012 40.404-12.012z" fill="#f5af02" />
      <path d="M214.879 29.041h17.813l25.565 51.218 25.506-51.218H299.9l-46.459 91.184h-16.927l13.406-25.419-35.041-65.765z" fill="#86b817" />
    </svg>
  );
}

// Google Merchant Center's icon (not the plain "G" mark) — the integration
// this represents pushes the catalogue to Merchant Center specifically (see
// integrations.tsx's description), so its own icon identifies that more
// precisely than the generic Google logo would. Its gradient/shadow/shape
// defs need a unique id per render — this component renders once per row in
// lists (Products page channel dots, filter pills), and duplicate SVG
// `id`s across multiple instances on one page produce invalid, potentially
// misresolved references — so every id is namespaced with useId().
export function GoogleLogo({ className }: { className?: string }) {
  const uid = useId();
  const gradId = `gmc-grad-${uid}`;
  const shapeId = `gmc-shape-${uid}`;
  const shadowId = `gmc-shadow-${uid}`;

  return (
    <svg viewBox="0.2 0.2 409.8 409.601" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <title>Google Merchant Center</title>
      <defs>
        <linearGradient id={gradId} x1="100%" x2="0%" y1="100%" y2="0%">
          <stop offset="0" stopColor="#4385f5" />
          <stop offset="1" stopColor="#3569d3" />
        </linearGradient>
        <path
          id={shapeId}
          d="M137.5 201c-8.56 0-15.5-6.94-15.5-15.5s6.94-15.5 15.5-15.5 15.5 6.94 15.5 15.5-6.94 15.5-15.5 15.5zm165.364 47.632l-93.6-93.6C205.52 151.288 200.32 149 194.6 149h-72.8a20.728 20.728 0 0 0-20.8 20.8v72.8c0 5.72 2.288 10.92 6.136 14.664l93.496 93.6C204.48 354.608 209.68 357 215.4 357s10.92-2.392 14.664-6.136l72.8-72.8C306.712 274.32 309 269.12 309 263.4c0-5.824-2.392-11.024-6.136-14.768z"
        />
        <filter id={shadowId} height="120.7%" width="120.7%" x="-8.4%" y="-8.4%">
          <feOffset dx="4" dy="4" in="SourceAlpha" result="shadowOffsetOuter1" />
          <feGaussianBlur in="shadowOffsetOuter1" result="shadowBlurOuter1" stdDeviation="6.5" />
          <feColorMatrix in="shadowBlurOuter1" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.16 0" />
        </filter>
      </defs>
      <g fill="none" fillRule="evenodd">
        <path d="M.2 98.333h409.6V375.67c0 18.85-15.278 34.13-34.13 34.13H34.33C15.48 409.8.2 394.514.2 375.67z" fill="#518ff5" />
        <path
          d="M144.713 294.215l106.371-97.264L410 355.63l-.074 20.037c-.07 18.851-15.405 34.134-34.26 34.134H260.808z"
          fill={`url(#${gradId})`}
        />
        <path d="M.2 34.333C.2 15.482 15.478.2 34.33.2h341.34c18.85 0 34.13 15.28 34.13 34.133v64H.2z" fill="#4758b8" />
        <path
          d="M187.933 47.133h-40.539c-8.245 0-14.927 6.686-14.927 14.934 0 8.249 6.683 14.933 14.927 14.933h115.212c8.245 0 14.927-6.686 14.927-14.933 0-8.25-6.683-14.934-14.927-14.934h-40.54v-4.266c0-9.43-7.64-17.067-17.066-17.067-9.428 0-17.067 7.641-17.067 17.067z"
          fill="#fff"
        />
        <g fillRule="nonzero">
          <use fill="#000" filter={`url(#${shadowId})`} href={`#${shapeId}`} />
          <use fill="#fff" fillRule="evenodd" href={`#${shapeId}`} />
        </g>
      </g>
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
