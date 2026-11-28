// Email campaigns and their contacts, mirroring server/src/models.

import type { ComponentType } from "react";
import type { BeResponse } from "@/lib/api/base";

export type ContactStatus = "subscribed" | "unsubscribed" | "bounced";
export type ContactSource = "newsletter" | "import" | "customer" | "manual";

export interface Contact {
  _id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: ContactStatus;
  source: ContactSource;
  lists: string[];
  subscribed_at: string;
  unsubscribed_at: string | null;
  bounced_at: string | null;
  bounce_reason: string | null;
  last_emailed_at: string | null;
  created_at: string;
}

export interface ContactStats {
  total: number;
  by_status: Partial<Record<ContactStatus, number>>;
  by_source: Partial<Record<ContactSource, number>>;
}

export interface ContactList {
  name: string;
  total: number;
  subscribed: number;
}

export interface ContactFilters {
  search?: string;
  status?: ContactStatus;
  list?: string;
  source?: ContactSource;
}

export interface ContactSelection {
  ids: string[];
  total: number;
  capped: boolean;
}

export interface ContactPayload {
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  lists?: string[];
  status?: "unsubscribed";
}

export interface ContactImportResult {
  created: number;
  updated: number;
  unsubscribed: number;
  invalid: number;
  duplicates: number;
  total: number;
}

export type CampaignKind = "one_time" | "recurring";
export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "active" | "paused";
export type AudienceType = "all" | "lists" | "contacts";
export type RecurrenceFrequency = "weekly" | "fortnightly" | "monthly";
export type RunStatus = "queued" | "sending" | "completed" | "failed";

export interface CampaignAudience {
  type: AudienceType;
  lists: string[];
  contact_ids: string[];
}

export interface CampaignRecurrence {
  frequency: RecurrenceFrequency;
  day_of_week: number;
  day_of_month: number;
  time: string;
  timezone: string;
}

export interface CampaignRun {
  _id: string;
  status: RunStatus;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  started_at: string;
  finished_at: string | null;
  error: string | null;
}

export interface Campaign {
  _id: string;
  name: string;
  kind: CampaignKind;
  status: CampaignStatus;
  subject: string;
  preheader: string;
  audience: CampaignAudience;
  scheduled_at: string | null;
  recurrence: CampaignRecurrence;
  next_run_at: string | null;
  last_run_at: string | null;
  runs_count: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignListItem extends Campaign {
  last_run: CampaignRun | null;
}

export interface CampaignDetail extends Campaign {
  body_html: string;
  design: EmailDesign | null;
  runs: CampaignRun[];
  audience_count: number;
  audience_contacts: Contact[];
  recipient_limit: number;
}

export interface CampaignPayload {
  name?: string;
  kind?: CampaignKind;
  subject?: string;
  preheader?: string;
  body_html?: string;
  design?: EmailDesign | null;
  audience?: CampaignAudience;
  recurrence?: CampaignRecurrence;
}

export type CampaignsTab = "campaigns" | "contacts" | "follow-ups" | "feedback";

// Email builder, mirroring server/src/validators/campaign-design.validation.

export type BlockAlign = "left" | "center" | "right";
export type DesignFont = "arial" | "helvetica" | "verdana" | "trebuchet" | "georgia" | "times";
export type SocialNetwork = "facebook" | "instagram" | "x" | "youtube" | "tiktok" | "linkedin" | "website";

export interface DesignSettings {
  background_color: string;
  content_background: string;
  content_width: number;
  font_family: DesignFont;
  text_color: string;
  link_color: string;
}

interface BlockCommon {
  padding_y?: number;
  background?: string;
}

export interface HeadingProps extends BlockCommon {
  text: string;
  level: 1 | 2 | 3;
  align: BlockAlign;
  color?: string;
  font_size?: number;
}

export interface TextProps extends BlockCommon {
  html: string;
  align: BlockAlign;
  color?: string;
  font_size?: number;
}

export interface ButtonProps extends BlockCommon {
  label: string;
  url: string;
  align: BlockAlign;
  bg_color: string;
  text_color: string;
  radius: number;
  full_width: boolean;
}

export interface ImageProps extends BlockCommon {
  src: string;
  alt: string;
  link_url: string;
  width: number;
  align: BlockAlign;
  radius: number;
}

export interface LogoProps extends BlockCommon {
  width: number;
  align: BlockAlign;
}

export interface DividerProps extends BlockCommon {
  color: string;
  thickness: number;
}

export interface SpacerProps extends BlockCommon {
  height: number;
}

export interface ProductItem {
  product_id?: string | null;
  title: string;
  price_label: string;
  image: string;
  url: string;
}

export interface ProductsProps extends BlockCommon {
  columns: 1 | 2 | 3;
  show_price: boolean;
  button_label: string;
  accent_color: string;
  items: ProductItem[];
}

export interface SocialLink {
  network: SocialNetwork;
  url: string;
}

export interface SocialProps extends BlockCommon {
  align: BlockAlign;
  color?: string;
  links: SocialLink[];
}

export type LeafBlock =
  | { id: string; type: "heading"; props: HeadingProps }
  | { id: string; type: "text"; props: TextProps }
  | { id: string; type: "button"; props: ButtonProps }
  | { id: string; type: "image"; props: ImageProps }
  | { id: string; type: "divider"; props: DividerProps }
  | { id: string; type: "spacer"; props: SpacerProps };

export interface ColumnsProps extends BlockCommon {
  gap: number;
  columns: [{ blocks: LeafBlock[] }, { blocks: LeafBlock[] }];
}

export type DesignBlock =
  | LeafBlock
  | { id: string; type: "logo"; props: LogoProps }
  | { id: string; type: "products"; props: ProductsProps }
  | { id: string; type: "social"; props: SocialProps }
  | { id: string; type: "columns"; props: ColumnsProps };

export type BlockType = DesignBlock["type"];
export type LeafBlockType = LeafBlock["type"];

export interface EmailDesign {
  settings: DesignSettings;
  blocks: DesignBlock[];
}

export interface CampaignTemplate {
  _id: string;
  name: string;
  design: EmailDesign;
  updated_at: string;
}

export interface StarterTemplate {
  key: string;
  name: string;
  description: string;
  design: EmailDesign;
}

export interface CampaignPreview {
  subject: string;
  html: string;
}

export interface PaletteItem {
  type: BlockType;
  label: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
}

// Builder previews: campaigns and follow-ups render through their own API.
export type PreviewFn = (payload: { design: EmailDesign; subject: string; preheader: string }) => Promise<BeResponse<CampaignPreview>>;
