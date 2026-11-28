import { z } from "zod";
import { META_LIMITS } from "@/config/seo";

const seoMeta = z.object({
  meta_title: z.string().trim().max(META_LIMITS.titleMax),
  meta_description: z.string().trim().max(META_LIMITS.descriptionMax),
  og_image: z.string().trim(),
  canonical_url: z.string().trim().refine((v) => !v || /^https?:\/\//.test(v), "Use a full https:// address"),
  noindex: z.boolean(),
});

export const articleFormSchema = z.object({
  title: z.string().trim().min(1, "Give the article a title").max(200),
  slug: z.string().trim().max(120),
  excerpt: z.string().trim().max(400),
  body_html: z.string(),
  cover_image: z.string().trim(),
  cover_alt: z.string().trim().max(200),
  tags: z.array(z.string()).max(15, "Up to 15 tags"),
  author_name: z.string().trim().max(80),
  status: z.enum(["draft", "published"]),
  published_at: z.string().nullable(),
  seo: seoMeta,
});

export type ArticleFormValues = z.infer<typeof articleFormSchema>;

export const contentPageFormSchema = z.object({
  title: z.string().trim().min(1, "Give the page a title").max(200),
  slug: z.string().trim().max(120),
  body_html: z.string(),
  status: z.enum(["draft", "published"]),
  show_in_footer: z.boolean(),
  footer_order: z.number().int().min(0).max(1000),
  seo: seoMeta,
});

export type ContentPageFormValues = z.infer<typeof contentPageFormSchema>;

export const redirectFormSchema = z.object({
  from_path: z.string().trim().min(1, "Enter the old address"),
  to_path: z
    .string()
    .trim()
    .min(1, "Enter where it should go")
    .refine((v) => v.startsWith("/") || /^https?:\/\//.test(v), "Start with / for a store page, or https:// for another site"),
  type: z.enum(["301", "302"]),
});

export type RedirectFormValues = z.infer<typeof redirectFormSchema>;

const pageMeta = z.object({
  meta_title: z.string().trim().max(META_LIMITS.titleMax),
  meta_description: z.string().trim().max(META_LIMITS.descriptionMax),
});

export const seoSettingsFormSchema = z.object({
  site_name: z.string().trim().max(80),
  title_template: z.string().trim().max(80).refine((v) => v.includes("%s"), "Include %s where the page title goes"),
  default_description: z.string().trim().max(META_LIMITS.descriptionMax),
  default_og_image: z.string().trim(),
  google_verification: z.string().trim().max(120),
  bing_verification: z.string().trim().max(120),
  social_profiles: z.array(z.string()),
  robots_disallow: z.array(z.string()),
  page_meta: z.object({ home: pageMeta, shop: pageMeta, categories: pageMeta, bundles: pageMeta, blog: pageMeta }),
});

export type SeoSettingsFormValues = z.infer<typeof seoSettingsFormSchema>;
