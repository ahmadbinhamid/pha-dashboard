import { Zap } from "lucide-react";
import { promoThemeStyle } from "@/lib/storefront/themeStyle";
import type { PromoTheme } from "@/types/storefront";
import { cn } from "@/utils/cn";

interface SaleCardPreviewProps {
  theme: PromoTheme;
  bgColor: string;
  textColor: string;
  headline: string;
  code: string | null;
}

/** Small mock of the product page sale card, for picking its colours. */
export function SaleCardPreview({ theme, bgColor, textColor, headline, code }: SaleCardPreviewProps) {
  const style = promoThemeStyle(theme, bgColor, textColor);
  return (
    <div className={cn("rounded-xl p-4", style.className)} style={style.style}>
      <p className="flex items-center gap-1.5 text-3xs font-bold tracking-widest uppercase opacity-85">
        <Zap className="h-3 w-3 fill-current" />
        Flash sale
      </p>
      <p className="mt-1.5 text-lg leading-none font-black">{headline}</p>
      <p className="mt-3 inline-flex rounded-lg border border-dashed border-current/50 px-2.5 py-1 font-mono text-xs font-bold">
        {code ?? "Applied at checkout"}
      </p>
    </div>
  );
}
