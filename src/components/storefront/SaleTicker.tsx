import { Zap } from "lucide-react";
import { SaleCountdown } from "@/components/storefront/SaleCountdown";
import { TICKER_DURATION_SECONDS } from "@/config/storefront";
import { promoThemeStyle } from "@/lib/storefront/themeStyle";
import { saleTickerText } from "@/lib/storefront/salePricing";
import type { PromotedSale } from "@/types/storefront";
import { cn } from "@/utils/cn";

// animate-marquee shifts by -50%, so the repeat count must stay even.
const REPEATS = 6;

// Mirrors pha-storefront's SaleTicker so the preview matches the live site.
export function SaleTicker({ sale }: { sale: PromotedSale }) {
  const text = saleTickerText(sale);
  const theme = promoThemeStyle(sale.ticker_theme, sale.ticker_bg_color, sale.ticker_text_color);
  return (
    <div className={cn("flex items-stretch overflow-hidden", theme.className)} style={theme.style}>
      <div className="z-10 flex shrink-0 items-center gap-2 bg-luxury-ink px-3 text-2xs text-accent-fg">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
        </span>
        <span className="font-bold tracking-widest uppercase">Flash sale</span>
        {sale.show_countdown && sale.ends_at ? <SaleCountdown endsAt={sale.ends_at} className="text-accent" /> : null}
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div
          className="flex w-max animate-marquee items-center gap-8 py-2 text-2xs font-bold tracking-wide uppercase"
          style={{ animationDuration: `${TICKER_DURATION_SECONDS[sale.ticker_speed]}s` }}
        >
          {Array.from({ length: REPEATS }, (_, i) => (
            <span key={i} className="flex items-center gap-8 whitespace-nowrap">
              {text}
              <Zap className="h-3 w-3 fill-current" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
