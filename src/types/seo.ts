// SEO & content, mirroring server/src/models (Article, ContentPage, …).

export type ContentStatus = "draft" | "published";
// Derived by the server: published with a future date is scheduled.
export type ContentState = "draft" | "scheduled" | "published";
export type RedirectType = 301 | 302;
export type PageMetaKey = "home" | "shop" | "categories" | "bundles" | "blog";
export type SeoTab = "articles" | "pages" | "products" | "categories" | "redirects" | "settings";

export interface SeoMeta {
  meta_title: string;
  meta_description: string;
  og_image: string;
  canonical_url: string;
  noindex: boolean;
}

export interface Article {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  body_html?: string;
  cover_image: string;
  cover_alt: string;
  tags: string[];
  author_name: string;
  status: ContentStatus;
  state: ContentState;
  published_at: string | null;
  reading_minutes: number;
  seo: SeoMeta;
  created_at: string;
  updated_at: string;
}

export interface ArticlePayload {
  title?: string;
  slug?: string;
  excerpt?: string;
  body_html?: string;
  cover_image?: string;
  cover_alt?: string;
  tags?: string[];
  author_name?: string;
  status?: ContentStatus;
  published_at?: string | null;
  seo?: Partial<SeoMeta>;
}

export interface ArticleTag {
  tag: string;
  count: number;
}

export interface ContentPage {
  _id: string;
  title: string;
  slug: string;
  body_html?: string;
  status: ContentStatus;
  show_in_footer: boolean;
  footer_order: number;
  seo: SeoMeta;
  updated_at: string;
}

export interface ContentPagePayload {
  title?: string;
  slug?: string;
  body_html?: string;
  status?: ContentStatus;
  show_in_footer?: boolean;
  footer_order?: number;
  seo?: Partial<SeoMeta>;
}

export interface Redirect {
  _id: string;
  from_path: string;
  to_path: string;
  type: RedirectType;
  hits: number;
  last_hit_at: string | null;
  created_at: string;
}

export interface RedirectPayload {
  from_path?: string;
  to_path?: string;
  type?: RedirectType;
}

export interface ProductSeoRow {
  _id: string;
  title: string;
  slug: string;
  image: string | null;
  description_text: string;
  seo: SeoMeta;
}

export interface CategorySeoRow {
  _id: string;
  name: string;
  slug: string;
  description: string;
  seo: SeoMeta;
}

export interface PageMeta {
  meta_title: string;
  meta_description: string;
}

export interface SeoSettings {
  site_name: string;
  title_template: string;
  default_description: string;
  default_og_image: string;
  google_verification: string;
  bing_verification: string;
  social_profiles: string[];
  robots_disallow: string[];
  page_meta: Record<PageMetaKey, PageMeta>;
  storefront_url: string;
  updated_at: string | null;
}

export type SeoSettingsPayload = Partial<Omit<SeoSettings, "storefront_url" | "updated_at">>;

export interface SeoOverview {
  articles: Record<ContentState, number>;
  pages: { published: number; draft: number };
  redirects: number;
  products_missing_description: number;
}

// A product or category being edited in the SEO modal.
export interface SeoMetaTarget {
  id: string;
  name: string;
  path: string;
  fallbackDescription: string;
  seo: SeoMeta;
}
