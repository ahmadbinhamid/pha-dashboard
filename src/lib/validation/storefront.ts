import { z } from "zod";
import { HERO_AUTOPLAY_SECONDS, HERO_OVERLAY } from "@/config/storefront";

// Storefront-relative paths or absolute http(s) links, mirroring the server.
const link = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\/\S*$/.test(v) || /^https?:\/\/\S+$/.test(v), "Use a /path or a full https:// link");
// The server also allows plain http only for its own uploads (local dev).
const imageUrl = z.string().trim().regex(/^https?:\/\/\S+$/, "Use an https:// image link or upload a photo");
const hexColor = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use a #RRGGBB colour");
const optionalDate = z.string().nullable();
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

export const flashSaleFormSchema = z.object({
  discount_id: z.string().nullable(),
  ticker_text: z.string().trim().max(160),
  ticker_speed: z.enum(["slow", "normal", "fast"]),
  ticker_theme: z.enum(["brand", "crimson", "carbon", "custom"]),
  ticker_bg_color: hexColor,
  ticker_text_color: hexColor,
  show_countdown: z.boolean(),
  show_hero_card: z.boolean(),
  show_product_badges: z.boolean(),
});

export type FlashSaleFormValues = z.infer<typeof flashSaleFormSchema>;
