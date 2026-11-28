// SEO & content: tabs, limits, badges and option lists.

import type { ContentState, PageMetaKey, RedirectType, SeoMeta, SeoTab } from "@/types/seo";

type BadgeVariant = "default" | "ok" | "warn" | "danger" | "muted" | "outline";

export const SEO_BASE_PATH = "/seo";
export const SEO_TABS: readonly SeoTab[] = ["articles", "pages", "products", "categories", "redirects", "settings"];

export const SEO_TAB_LABEL: Record<SeoTab, string> = {
  articles: "Blog",
  pages: "Pages",
  products: "Product SEO",
  categories: "Category SEO",
  redirects: "Redirects",
  settings: "Site settings",
};

// Mirrors server META_LIMITS: Google truncates past the soft limits.
export const META_LIMITS = { title: 60, description: 160, titleMax: 120, descriptionMax: 320 } as const;

export const CONTENT_STATE_BADGE: Record<ContentState, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "muted" },
  scheduled: { label: "Scheduled", variant: "warn" },
  published: { label: "Published", variant: "ok" },
};

export const CONTENT_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

export const REDIRECT_TYPE_OPTIONS: { value: `${RedirectType}`; label: string }[] = [
  { value: "301", label: "301 · Permanent (moves SEO value)" },
  { value: "302", label: "302 · Temporary" },
];

export const PAGE_META_LABEL: Record<PageMetaKey, { label: string; path: string }> = {
  home: { label: "Home page", path: "/" },
  shop: { label: "Shop", path: "/shop" },
  categories: { label: "All categories", path: "/categories" },
  bundles: { label: "Bundles", path: "/bundles" },
  blog: { label: "Blog", path: "/blog" },
};

export const EMPTY_SEO_META: SeoMeta = {
  meta_title: "",
  meta_description: "",
  og_image: "",
  canonical_url: "",
  noindex: false,
};

export const MAX_ARTICLE_TAGS = 15;
export const SEO_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
