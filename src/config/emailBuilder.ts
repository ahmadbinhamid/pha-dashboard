// Email builder palette, block defaults and design options.

import {
  Columns2,
  Heading,
  Image,
  Minus,
  MousePointerClick,
  MoveVertical,
  Share2,
  ShoppingBag,
  Stamp,
  Type,
} from "lucide-react";
import type { ComponentType } from "react";
import type { BlockType, DesignBlock, DesignFont, DesignSettings, LeafBlockType, SocialNetwork } from "@/types/campaign";

export interface PaletteItem {
  type: BlockType;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}

export const BLOCK_PALETTE: PaletteItem[] = [
  { type: "logo", label: "Logo", hint: "Your store logo", icon: Stamp },
  { type: "heading", label: "Heading", hint: "Big title text", icon: Heading },
  { type: "text", label: "Text", hint: "Paragraphs and lists", icon: Type },
  { type: "button", label: "Button", hint: "Call to action", icon: MousePointerClick },
  { type: "image", label: "Image", hint: "Banner or photo", icon: Image },
  { type: "products", label: "Products", hint: "Items from your catalogue", icon: ShoppingBag },
  { type: "columns", label: "Two columns", hint: "Side-by-side content", icon: Columns2 },
  { type: "social", label: "Social links", hint: "Facebook, Instagram…", icon: Share2 },
  { type: "divider", label: "Divider", hint: "A thin line", icon: Minus },
  { type: "spacer", label: "Spacer", hint: "Empty space", icon: MoveVertical },
];

export const LEAF_BLOCK_TYPES: LeafBlockType[] = ["heading", "text", "button", "image", "divider", "spacer"];

export const BLOCK_LABEL = Object.fromEntries(BLOCK_PALETTE.map((p) => [p.type, p.label])) as Record<BlockType, string>;

// Mirrors server DESIGN_FONTS: web-safe stacks that render in every client.
export const DESIGN_FONT_OPTIONS: { value: DesignFont; label: string; stack: string }[] = [
  { value: "arial", label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  { value: "helvetica", label: "Helvetica", stack: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { value: "verdana", label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  { value: "trebuchet", label: "Trebuchet", stack: "'Trebuchet MS', Tahoma, sans-serif" },
  { value: "georgia", label: "Georgia (serif)", stack: "Georgia, 'Times New Roman', serif" },
  { value: "times", label: "Times (serif)", stack: "'Times New Roman', Times, serif" },
];

export const SOCIAL_NETWORK_OPTIONS: { value: SocialNetwork; label: string }[] = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "website", label: "Website" },
];

export const ALIGN_OPTIONS = [
  { value: "left" as const, label: "Left" },
  { value: "center" as const, label: "Centre" },
  { value: "right" as const, label: "Right" },
];

export const HEADING_LEVEL_OPTIONS = [
  { value: "1", label: "Large" },
  { value: "2", label: "Medium" },
  { value: "3", label: "Small" },
];

export const PRODUCT_COLUMN_OPTIONS = [
  { value: "1", label: "1 per row" },
  { value: "2", label: "2 per row" },
  { value: "3", label: "3 per row" },
];

export const BRAND_ACCENT = "#f97316";

export const DEFAULT_DESIGN_SETTINGS: DesignSettings = {
  background_color: "#f4f4f5",
  content_background: "#ffffff",
  content_width: 600,
  font_family: "arial",
  text_color: "#333333",
  link_color: BRAND_ACCENT,
};

// Mirrors server DESIGN_LIMITS.
export const DESIGN_LIMITS = {
  maxBlocks: 60,
  maxColumnBlocks: 8,
  maxProducts: 6,
  minWidth: 480,
  maxWidth: 720,
};

export const DEFAULT_BLOCK_PROPS: { [T in BlockType]: Extract<DesignBlock, { type: T }>["props"] } = {
  heading: { text: "Your headline here", level: 2, align: "center" },
  text: { html: "<p>Write your message here. Use {{first_name}} to greet people by name.</p>", align: "left" },
  button: {
    label: "Shop now",
    url: "/",
    align: "center",
    bg_color: BRAND_ACCENT,
    text_color: "#ffffff",
    radius: 6,
    full_width: false,
  },
  image: { src: "", alt: "", link_url: "", width: 100, align: "center", radius: 0 },
  logo: { width: 140, align: "center" },
  divider: { color: "#e4e4e7", thickness: 1 },
  spacer: { height: 24 },
  products: { columns: 2, show_price: true, button_label: "View", accent_color: BRAND_ACCENT, items: [] },
  social: { align: "center", links: [{ network: "facebook", url: "" }, { network: "instagram", url: "" }] },
  columns: { gap: 16, columns: [{ blocks: [] }, { blocks: [] }] },
};

export const PREVIEW_WIDTHS = { desktop: 680, mobile: 375 };
export const BUILDER_DRAG_PREFIX = "palette:";
