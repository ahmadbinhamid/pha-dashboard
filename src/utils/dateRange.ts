// Shared by the generic DateRangePicker (src/components/ui/DateRangePicker.tsx)
// and every page that filters by a date range (currently the Dashboard's
// Order Volume / Revenue Trends charts and the Activity Log) so every "what
// period am I looking at" label on the page — including the picker's own
// trigger button — always agrees, instead of each place independently
// formatting the same {from, to}.

// yyyy-mm-dd — a range with no filter applied is `{}`, not two empty
// strings, so "unset" can't be confused with an actual (if odd) date.
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

// A range with no filter applied has no "what period" to show — the caller
// decides what that should read as (e.g. "Last 14 days" when the backend's
// own default window is well known, or "All time").
export function formatDateRangeLabel(range: DateRangeValue, placeholder = "Select range") {
  if (!range.from || !range.to) return placeholder;
  return `${formatIsoLabel(range.from)} – ${formatLongLabel(range.to)}`;
}

// yyyy-mm-dd from LOCAL calendar fields — not toISOString(), which converts
// through UTC first and can shift the date by a day depending on the
// viewer's timezone offset (the same class of bug fixed in the backend's
// own date-bucketing — see dashboard.service.js).
export function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

// The concrete [today - (days-1), today] window a "7D"-style preset chip
// resolves to — computed once here so a picker's preset button and a page's
// own initial filter state (e.g. Dashboard defaulting to the last 7 days)
// can't drift into two different ideas of what "7 days" means.
export function getPresetRange(days: number): Required<DateRangeValue> {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (days - 1));
  return { from: toIsoDate(from), to: toIsoDate(to) };
}
