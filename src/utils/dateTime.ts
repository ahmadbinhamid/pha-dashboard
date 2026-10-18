// Local-time helpers for date+time fields stored as ISO strings.

const labelFmt = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "HH:mm" in local time, for a time input. */
export function timeOfDay(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** ISO for `date`'s calendar day at local "HH:mm". */
export function combineDateAndTime(date: Date, hhmm: string) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const next = new Date(date);
  next.setHours(hours || 0, minutes || 0, 0, 0);
  return next.toISOString();
}

/** "18 Oct 2026, 9:00 am". */
export function formatDateTimeLabel(iso: string) {
  return labelFmt.format(new Date(iso));
}
