// Follow-up email defaults, limits and option lists.

import { DEFAULT_DESIGN_SETTINGS } from "@/config/emailBuilder";
import type { EmailDesign } from "@/types/campaign";
import type { FollowUpChannel } from "@/types/followup";

export const FOLLOW_UPS_BASE_PATH = "/campaigns/follow-ups";

// Mirrors the server's FOLLOW_UP_LIMITS.
export const FOLLOW_UP_DAYS = { min: 1, max: 90 } as const;

export const FOLLOW_UP_CHANNEL_OPTIONS: { value: FollowUpChannel; label: string }[] = [
  { value: "storefront", label: "Website orders" },
  { value: "manual", label: "Counter sales (with an email)" },
];

export const ALERT_THRESHOLD_OPTIONS = [
  { value: "0", label: "Never" },
  { value: "1", label: "1 star" },
  { value: "2", label: "2 stars or fewer" },
  { value: "3", label: "3 stars or fewer" },
];

export const FEEDBACK_RATING_FILTER_OPTIONS = [
  { value: "all", label: "All ratings" },
  { value: "low", label: "Unhappy (1–2★)" },
  { value: "5", label: "5 stars" },
  { value: "4", label: "4 stars" },
  { value: "3", label: "3 stars" },
  { value: "2", label: "2 stars" },
  { value: "1", label: "1 star" },
];

export const LOW_RATING_MAX = 2;
export const RATING_MAX = 5;

export const FOLLOW_UP_MERGE_HINT = "Personalise with {{first_name}} and {{order_number}}";

export const DEFAULT_FOLLOW_UP_DESIGN: EmailDesign = {
  settings: { ...DEFAULT_DESIGN_SETTINGS },
  blocks: [
    { id: "logo", type: "logo", props: { width: 140, align: "center", padding_y: 20 } },
    { id: "heading", type: "heading", props: { text: "How are you finding your order, {{first_name}}?", level: 2, align: "left" } },
    {
      id: "text",
      type: "text",
      props: {
        html: "<p>Your order {{order_number}} should be with you by now. We'd love to know what you think, it only takes a few seconds and helps us stock the right parts.</p>",
        align: "left",
      },
    },
  ],
};

export const DEFAULT_FOLLOW_UP_SUBJECT = "How are you finding your order, {{first_name}}?";
