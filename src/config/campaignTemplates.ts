// Built-in starter designs; ids are replaced when one is applied.

import { BRAND_ACCENT, DEFAULT_DESIGN_SETTINGS } from "@/config/emailBuilder";
import type { StarterTemplate } from "@/types/campaign";

const social = {
  id: "social",
  type: "social" as const,
  props: {
    align: "center" as const,
    links: [
      { network: "facebook" as const, url: "" },
      { network: "instagram" as const, url: "" },
    ],
  },
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    key: "newsletter",
    name: "Monthly newsletter",
    description: "Logo, intro, featured story, products and a sign-off",
    design: {
      settings: { ...DEFAULT_DESIGN_SETTINGS },
      blocks: [
        { id: "logo", type: "logo", props: { width: 140, align: "center", padding_y: 20 } },
        { id: "h1", type: "heading", props: { text: "What's new this month", level: 1, align: "center" } },
        {
          id: "intro",
          type: "text",
          props: {
            html: "<p>Hi {{first_name}},</p><p>Here's a quick roundup of new stock, workshop tips and offers from the team.</p>",
            align: "left",
          },
        },
        { id: "img", type: "image", props: { src: "", alt: "Featured", link_url: "/", width: 100, align: "center", radius: 8 } },
        { id: "h2", type: "heading", props: { text: "Fresh in store", level: 2, align: "left" } },
        {
          id: "products",
          type: "products",
          props: { columns: 2, show_price: true, button_label: "View", accent_color: BRAND_ACCENT, items: [] },
        },
        {
          id: "cta",
          type: "button",
          props: {
            label: "Browse the shop",
            url: "/shop",
            align: "center",
            bg_color: BRAND_ACCENT,
            text_color: "#ffffff",
            radius: 6,
            full_width: false,
          },
        },
        { id: "div", type: "divider", props: { color: "#e4e4e7", thickness: 1 } },
        social,
      ],
    },
  },
  {
    key: "sale",
    name: "Sale announcement",
    description: "Bold coloured header, offer, code and a big button",
    design: {
      settings: { ...DEFAULT_DESIGN_SETTINGS, background_color: "#18181b" },
      blocks: [
        { id: "logo", type: "logo", props: { width: 120, align: "center", padding_y: 20 } },
        {
          id: "h1",
          type: "heading",
          props: { text: "20% OFF EVERYTHING", level: 1, align: "center", color: "#ffffff", font_size: 36, background: BRAND_ACCENT, padding_y: 32 },
        },
        {
          id: "copy",
          type: "text",
          props: {
            html: "<p>Hi {{first_name}}, our biggest sale of the season is on now. Use code <strong>SAVE20</strong> at checkout.</p>",
            align: "center",
            font_size: 17,
          },
        },
        {
          id: "cta",
          type: "button",
          props: {
            label: "Shop the sale",
            url: "/shop",
            align: "center",
            bg_color: "#18181b",
            text_color: "#ffffff",
            radius: 4,
            full_width: true,
          },
        },
        { id: "fine", type: "text", props: { html: "<p>Ends Sunday at midnight. Excludes gift cards.</p>", align: "center", font_size: 12, color: "#71717a" } },
      ],
    },
  },
  {
    key: "arrivals",
    name: "New arrivals",
    description: "Showcase a grid of products straight from your catalogue",
    design: {
      settings: { ...DEFAULT_DESIGN_SETTINGS },
      blocks: [
        { id: "logo", type: "logo", props: { width: 140, align: "center", padding_y: 20 } },
        { id: "h1", type: "heading", props: { text: "Just landed", level: 1, align: "center" } },
        { id: "copy", type: "text", props: { html: "<p>Hand-picked parts that arrived this week.</p>", align: "center" } },
        {
          id: "products",
          type: "products",
          props: { columns: 3, show_price: true, button_label: "Shop", accent_color: BRAND_ACCENT, items: [] },
        },
        social,
      ],
    },
  },
  {
    key: "letter",
    name: "Simple letter",
    description: "Plain, personal note: just text and a signature",
    design: {
      settings: { ...DEFAULT_DESIGN_SETTINGS, font_family: "georgia" },
      blocks: [
        {
          id: "copy",
          type: "text",
          props: { html: "<p>Hi {{first_name}},</p><p>Write your note here.</p><p>Cheers,<br>The team</p>", align: "left" },
        },
      ],
    },
  },
];
