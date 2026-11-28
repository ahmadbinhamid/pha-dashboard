// Campaign and contact option lists, labels and badges.

import type {
  AudienceType,
  CampaignKind,
  CampaignStatus,
  CampaignsTab,
  ContactSource,
  ContactStatus,
  RecurrenceFrequency,
  RunStatus,
} from "@/types/campaign";

type BadgeVariant = "default" | "ok" | "warn" | "danger" | "muted" | "outline";

export const CAMPAIGNS_BASE_PATH = "/campaigns";
export const CAMPAIGNS_TABS: readonly CampaignsTab[] = ["campaigns", "follow-ups", "feedback", "contacts"];

export const CAMPAIGN_STATUS_BADGE: Record<CampaignStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: "Draft", variant: "muted" },
  scheduled: { label: "Scheduled", variant: "warn" },
  sending: { label: "Sending", variant: "warn" },
  sent: { label: "Sent", variant: "ok" },
  active: { label: "Active", variant: "ok" },
  paused: { label: "Paused", variant: "muted" },
};

export const RUN_STATUS_BADGE: Record<RunStatus, { label: string; variant: BadgeVariant }> = {
  queued: { label: "Queued", variant: "muted" },
  sending: { label: "Sending", variant: "warn" },
  completed: { label: "Completed", variant: "ok" },
  failed: { label: "Failed", variant: "danger" },
};

export const CONTACT_STATUS_BADGE: Record<ContactStatus, { label: string; variant: BadgeVariant }> = {
  subscribed: { label: "Subscribed", variant: "ok" },
  unsubscribed: { label: "Unsubscribed", variant: "muted" },
  bounced: { label: "Bounced", variant: "danger" },
};

export const CONTACT_SOURCE_LABEL: Record<ContactSource, string> = {
  newsletter: "Website signup",
  import: "Imported",
  customer: "Customer opt-in",
  manual: "Added by staff",
};

export const CAMPAIGN_KIND_OPTIONS: { value: CampaignKind; label: string }[] = [
  { value: "one_time", label: "One-off campaign" },
  { value: "recurring", label: "Recurring newsletter" },
];

export const CAMPAIGN_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...Object.entries(CAMPAIGN_STATUS_BADGE).map(([value, { label }]) => ({ value, label })),
];

export const CONTACT_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All contacts" },
  ...Object.entries(CONTACT_STATUS_BADGE).map(([value, { label }]) => ({ value, label })),
];

export const AUDIENCE_OPTIONS: { value: AudienceType; label: string }[] = [
  { value: "all", label: "All subscribers" },
  { value: "lists", label: "Lists" },
  { value: "contacts", label: "Pick contacts" },
];

export const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: "weekly", label: "Every week" },
  { value: "fortnightly", label: "Every two weeks" },
  { value: "monthly", label: "Every month" },
];

export const WEEKDAY_OPTIONS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
  (label, i) => ({ value: String(i), label }),
);

// Mirrors the server's MAX_MONTHLY_DAY: not every month has a 29th-31st.
export const MAX_MONTHLY_DAY = 28;
export const MONTH_DAY_OPTIONS = Array.from({ length: MAX_MONTHLY_DAY }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

// Mirrors the server's DEFAULT_TIMEZONE; stores trade on Australian time.
export const DEFAULT_CAMPAIGN_TIMEZONE = "Australia/Sydney";
export const TIMEZONE_OPTIONS = [
  { value: "Australia/Sydney", label: "Sydney / Canberra (AEST)" },
  { value: "Australia/Melbourne", label: "Melbourne (AEST)" },
  { value: "Australia/Hobart", label: "Hobart (AEST)" },
  { value: "Australia/Brisbane", label: "Brisbane (no DST)" },
  { value: "Australia/Adelaide", label: "Adelaide (ACST)" },
  { value: "Australia/Darwin", label: "Darwin (no DST)" },
  { value: "Australia/Perth", label: "Perth (AWST)" },
];

export const MERGE_TAGS = [
  { tag: "{{first_name}}", label: "First name", hint: "\"there\" when unknown" },
  { tag: "{{last_name}}", label: "Last name", hint: "blank when unknown" },
  { tag: "{{email}}", label: "Email", hint: "the recipient's address" },
];

export const IMPORT_COLUMNS_HINT = "Email (required), First name, Last name, Lists";
export const IMPORT_ACCEPT = ".xlsx,.csv";
export const IMPORT_MAX_MB = 5;

// Runs still in flight refresh on this interval so counters move live.
export const LIVE_RUN_REFETCH_MS = 4000;

// Mirrors the server's MAX_SELECTED_CONTACTS for a hand-picked audience.
export const MAX_SELECTED_CONTACTS = 500;
