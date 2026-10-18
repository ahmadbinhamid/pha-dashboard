import { promoThemeStyle } from "@/lib/storefront/themeStyle";
import type { PromoTheme } from "@/types/storefront";
import { cn } from "@/utils/cn";

interface SaleBadgeProps {
  theme: PromoTheme;
  bgColor: string;
  textColor: string;
  children: React.ReactNode;
  className?: string;
}

/** The storefront's "-20%" sale tag, in the promotion's badge colours. */
export function SaleBadge({ theme, bgColor, textColor, children, className }: SaleBadgeProps) {
  const style = promoThemeStyle(theme, bgColor, textColor);
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-3xs font-bold uppercase", style.className, className)} style={style.style}>
      {children}
    </span>
  );
}
