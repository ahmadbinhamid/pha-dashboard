import { ANNOUNCEMENT_THEMES, PROMO_THEMES } from "@/config/storefront";
import type { Announcement, PromoTheme } from "@/types/storefront";

/** Class + inline colours for a strip, custom themes use the picked hex. */
export function announcementThemeStyle(a: Pick<Announcement, "theme" | "bg_color" | "text_color">) {
  if (a.theme === "custom") return { className: "", style: { backgroundColor: a.bg_color, color: a.text_color } };
  return { className: (ANNOUNCEMENT_THEMES.find((t) => t.value === a.theme) ?? ANNOUNCEMENT_THEMES[0]).className, style: undefined };
}

/** Same for the ticker, sale card and badge, each with its own colours. */
export function promoThemeStyle(theme: PromoTheme, bgColor: string, textColor: string) {
  if (theme === "custom") return { className: "", style: { backgroundColor: bgColor, color: textColor } };
  return { className: (PROMO_THEMES.find((t) => t.value === theme) ?? PROMO_THEMES[0]).className, style: undefined };
}
