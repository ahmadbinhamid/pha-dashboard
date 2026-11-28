import { DEFAULT_CAMPAIGN_TIMEZONE, FREQUENCY_OPTIONS, WEEKDAY_OPTIONS } from "@/config/campaigns";
import { designFromHtml, normalizeDesign } from "@/lib/campaigns/emailDesign";
import type { CampaignFormValues } from "@/lib/validation/campaign";
import type { Campaign, CampaignDetail, CampaignPayload, CampaignRun } from "@/types/campaign";

export function campaignToFormValues(campaign: CampaignDetail | null): CampaignFormValues {
  const r = campaign?.recurrence;
  return {
    name: campaign?.name ?? "",
    kind: campaign?.kind ?? "one_time",
    subject: campaign?.subject ?? "",
    preheader: campaign?.preheader ?? "",
    design: campaign?.design ? normalizeDesign(campaign.design) : designFromHtml(campaign?.body_html ?? ""),
    audience_type: campaign?.audience.type ?? "all",
    audience_lists: campaign?.audience.lists ?? [],
    audience_contact_ids: campaign?.audience.contact_ids ?? [],
    frequency: r?.frequency ?? "weekly",
    day_of_week: String(r?.day_of_week ?? 1),
    day_of_month: String(r?.day_of_month ?? 1),
    time: r?.time ?? "09:00",
    timezone: r?.timezone ?? DEFAULT_CAMPAIGN_TIMEZONE,
  };
}

export function formValuesToPayload(v: CampaignFormValues): CampaignPayload {
  return {
    name: v.name,
    kind: v.kind,
    subject: v.subject,
    preheader: v.preheader,
    design: v.design,
    audience: {
      type: v.audience_type,
      lists: v.audience_type === "lists" ? v.audience_lists : [],
      contact_ids: v.audience_type === "contacts" ? v.audience_contact_ids : [],
    },
    recurrence: {
      frequency: v.frequency,
      day_of_week: Number(v.day_of_week),
      day_of_month: Number(v.day_of_month),
      time: v.time,
      timezone: v.timezone,
    },
  };
}

/** "Every week on Tuesday at 10:30 (Australia/Perth)". */
export function describeRecurrence({ recurrence: r }: Pick<Campaign, "recurrence">) {
  const freq = FREQUENCY_OPTIONS.find((o) => o.value === r.frequency)?.label ?? "Every week";
  const day =
    r.frequency === "monthly" ? `on day ${r.day_of_month}` : `on ${WEEKDAY_OPTIONS[r.day_of_week]?.label ?? "Monday"}`;
  return `${freq} ${day} at ${r.time} (${r.timezone})`;
}

/** Viewer-local by default; pass a zone to show the store's wall clock. */
export function formatDateTime(iso: string | null | undefined, timeZone?: string) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!timeZone) return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  // dateStyle/timeStyle can't be combined with timeZoneName, so spell it out.
  return date.toLocaleString(undefined, {
    timeZone,
    timeZoneName: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "120 sent · 2 failed" style summary of a run's counters. */
export function describeRun(run: CampaignRun) {
  const parts = [`${run.sent} sent`];
  if (run.failed) parts.push(`${run.failed} failed`);
  if (run.skipped) parts.push(`${run.skipped} skipped`);
  if (run.total && run.status !== "completed") parts.push(`of ${run.total}`);
  return parts.join(" · ");
}

export const isRunLive = (run: CampaignRun | null | undefined) => run?.status === "queued" || run?.status === "sending";
