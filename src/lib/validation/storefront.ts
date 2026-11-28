import { z } from "zod";
import { MAX_PERCENT_OFF } from "@/config/discounts";
import { HERO_AUTOPLAY_SECONDS, HERO_OVERLAY, POPUP_DELAY_SECONDS, POPUP_FREQUENCY_DAYS } from "@/config/storefront";

// Storefront-relative paths or absolute http(s) links, mirroring the server.
const link = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\/\S*$/.test(v) || /^https?:\/\/\S+$/.test(v), "Use a /path or a full https:// link");
// The server also allows plain http only for its own uploads (local dev).
const imageUrl = z.string().trim().regex(/^https?:\/\/\S+$/, "Use an https:// image link or upload a photo");
const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB colour");
const optionalDate = z.string().nullable();
const promoTheme = z.enum(["brand", "crimson", "carbon", "custom"]);
const endsAfterStart = (v: { starts_at: string | null; ends_at: string | null }) =>
  !v.starts_at || !v.ends_at || new Date(v.ends_at) > new Date(v.starts_at);

export const heroSlideFormSchema = z
  .object({
    title: z.string().trim().min(1, "Add a title").max(120),
    subtitle: z.string().trim().max(240),
    badge: z.string().trim().max(32),
    cta_label: z.string().trim().max(40),
    cta_url: link,
    secondary_cta_label: z.string().trim().max(40),
    secondary_cta_url: link,
    image_url: imageUrl,
    mobile_image_url: z.union([z.literal(""), imageUrl]),
    image_focus: z.enum(["center", "top", "bottom", "left", "right"]),
    align: z.enum(["left", "center", "right"]),
    vertical: z.enum(["top", "center", "bottom"]),
    text_tone: z.enum(["light", "dark"]),
    overlay: z.number().int().min(HERO_OVERLAY.min).max(HERO_OVERLAY.max),
    starts_at: optionalDate,
    ends_at: optionalDate,
    active: z.boolean(),
  })
  .refine(endsAfterStart, { path: ["ends_at"], message: "Must be after the start" });

export type HeroSlideFormValues = z.infer<typeof heroSlideFormSchema>;

export const heroSettingsFormSchema = z.object({
  autoplay: z.boolean(),
  interval_seconds: z.number().int().min(HERO_AUTOPLAY_SECONDS.min).max(HERO_AUTOPLAY_SECONDS.max),
  show_arrows: z.boolean(),
  show_dots: z.boolean(),
  height: z.enum(["compact", "standard", "tall"]),
});

export type HeroSettingsFormValues = z.infer<typeof heroSettingsFormSchema>;

export const announcementFormSchema = z
  .object({
    enabled: z.boolean(),
    message: z.string().trim().max(200),
    link_url: link,
    link_label: z.string().trim().max(30),
    theme: z.enum(["indigo", "crimson", "amber", "emerald", "carbon", "custom"]),
    bg_color: hexColor,
    text_color: hexColor,
    icon: z.enum(["none", "sparkles", "truck", "tag", "zap", "gift"]),
    dismissible: z.boolean(),
    placement: z.enum(["all_pages", "home_only"]),
    starts_at: optionalDate,
    ends_at: optionalDate,
  })
  .refine(endsAfterStart, { path: ["ends_at"], message: "Must be after the start" });

export type AnnouncementFormValues = z.infer<typeof announcementFormSchema>;

export const signupPopupFormSchema = z
  .object({
    enabled: z.boolean(),
    delay_seconds: z.number().int().min(POPUP_DELAY_SECONDS.min).max(POPUP_DELAY_SECONDS.max),
    headline: z.string().trim().min(1, "Add a headline").max(80),
    body: z.string().trim().max(300),
    button_label: z.string().trim().min(1, "Add button text").max(30),
    success_message: z.string().trim().max(160),
    image_url: imageUrl.or(z.literal("")),
    collect_first_name: z.boolean(),
    offer: z
      .object({
        enabled: z.boolean(),
        discount_type: z.enum(["percent", "fixed", "free_shipping"]),
        discount_value: z.number({ message: "Enter an amount" }).min(0),
        minimum_order: z.number({ message: "Enter 0 for no minimum" }).min(0),
        code_prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,10}$/, "2-10 letters or numbers"),
        code_valid_days: z.number().int().min(1).max(365).nullable(),
        issued_count: z.number(),
        redeemed_count: z.number(),
      })
      .superRefine((o, ctx) => {
        if (!o.enabled) return;
        if (o.discount_type === "percent" && (o.discount_value < 1 || o.discount_value > MAX_PERCENT_OFF)) {
          ctx.addIssue({ code: "custom", path: ["discount_value"], message: `Between 1% and ${MAX_PERCENT_OFF}%` });
        }
        if (o.discount_type === "fixed" && !(o.discount_value > 0)) {
          ctx.addIssue({ code: "custom", path: ["discount_value"], message: "Enter a dollar amount" });
        }
      }),
    list_name: z.string().trim().max(60),
    frequency_days: z.number().int().min(POPUP_FREQUENCY_DAYS.min).max(POPUP_FREQUENCY_DAYS.max),
    placement: z.enum(["all_pages", "home_only"]),
    starts_at: optionalDate,
    ends_at: optionalDate,
  })
  .refine(endsAfterStart, { path: ["ends_at"], message: "Must be after the start" });

export type SignupPopupFormValues = z.infer<typeof signupPopupFormSchema>;

export const flashSaleFormSchema = z.object({
  discount_id: z.string().nullable(),
  ticker_text: z.string().trim().max(160),
  ticker_speed: z.enum(["slow", "normal", "fast"]),
  ticker_theme: promoTheme,
  ticker_bg_color: hexColor,
  ticker_text_color: hexColor,
  card_theme: promoTheme,
  card_bg_color: hexColor,
  card_text_color: hexColor,
  badge_theme: promoTheme,
  badge_bg_color: hexColor,
  badge_text_color: hexColor,
  show_countdown: z.boolean(),
  show_hero_card: z.boolean(),
  show_product_badges: z.boolean(),
});

export type FlashSaleFormValues = z.infer<typeof flashSaleFormSchema>;
