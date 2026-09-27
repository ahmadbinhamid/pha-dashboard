// Shared by DateRangePicker and every date-filtered page (Dashboard charts, Activity Log) so every "what period" label agrees instead of each place formatting {from, to} independently.

// yyyy-mm-dd — a range with no filter is `{}`, not two empty strings, so "unset" can't be confused with an actual date.
export interface DateRangeValue {
  from?: string;
  to?: string;
}

export function formatIsoLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function formatLongLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

// A range with no filter has no "what period" to show — the caller decides what that reads as (e.g. "Last 14 days" or "All time").
export function formatDateRangeLabel(range: DateRangeValue, placeholder = "Select range") {
  if (!range.from || !range.to) return placeholder;
  return `${formatIsoLabel(range.from)} – ${formatLongLabel(range.to)}`;
}

// yyyy-mm-dd from local calendar fields, not toISOString() which converts through UTC and can shift the date by a day (same bug class fixed in dashboard.service.js's date-bucketing).
export function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

// The concrete [today - (days-1), today] window a "7D" preset resolves to, computed once here so a picker button and a page's initial filter state can't drift apart.
export function getPresetRange(days: number): Required<DateRangeValue> {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: toIsoDate(from), to: toIsoDate(to) };
}
