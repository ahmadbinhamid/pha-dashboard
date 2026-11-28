// Follow-up emails and customer feedback, mirroring server/src/models.

import type { EmailDesign } from "@/types/campaign";

export type FollowUpChannel = "storefront" | "manual";

export interface FollowUpSendCounts {
  queued: number;
  sent: number;
  failed: number;
  skipped: number;
}

export interface FollowUp {
  _id: string;
  name: string;
  shipped_delay_days: number;
  handover_delay_days: number;
  channels: FollowUpChannel[];
  subject: string;
  preheader: string;
  design?: EmailDesign | null;
  ask_for_rating: boolean;
  alert_at_or_below: number;
  alert_email: string;
  enabled: boolean;
  enabled_at: string | null;
  sends: FollowUpSendCounts;
  updated_at: string;
}

export interface FollowUpPayload {
  name?: string;
  shipped_delay_days?: number;
  handover_delay_days?: number;
  channels?: FollowUpChannel[];
  subject?: string;
  preheader?: string;
  design?: EmailDesign | null;
  ask_for_rating?: boolean;
  alert_at_or_below?: number;
  alert_email?: string;
}

export interface Feedback {
  _id: string;
  order_id: string | null;
  order_number: string | null;
  product_id: string | null;
  product_name: string;
  customer_name: string;
  customer_email: string;
  rating: number;
  comment: string;
  alerted_at: string | null;
  updated_at: string;
}

export interface FeedbackStats {
  count: number;
  average: number | null;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  low: number;
  emails_sent: number;
  response_rate: number | null;
}
