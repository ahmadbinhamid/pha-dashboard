// Australia/Sydney is hardcoded — no per-tenant timezone field exists anywhere (single-market app). notification_send_time is stored as UTC "HH:MM"; this converts to/from Sydney local time at the load/save boundary (InventorySettingsModal.tsx).

const SYDNEY_TZ = "Australia/Sydney";

// Sydney's UTC offset (minutes) for a given date, computed from the real IANA tz database via Intl (not hardcoded +10/+11), so it's correct across DST transitions automatically.
function sydneyOffsetMinutes(referenceDate: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: SYDNEY_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(referenceDate).map((p) => [p.type, p.value]));
  // Read the Sydney wall-clock components back as if they were UTC, then diff against the real UTC instant — that difference is the offset.
  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asIfUtc - referenceDate.getTime()) / 60_000);
}

function formatHhmm(totalMinutes: number): string {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "HH:MM" UTC -> "HH:MM" Sydney-local, for the Send Time input on load. `referenceDate` defaults to now; exposed as a param so tests can pin an AEST/AEDT date. */
export function utcTimeToSydney(utcHhmm: string, referenceDate: Date = new Date()): string {
  const [h, m] = utcHhmm.split(":").map(Number);
  const refUtc = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate(), h, m),
  );
  const offset = sydneyOffsetMinutes(refUtc);
  return formatHhmm(h * 60 + m + offset);
}

/** "HH:MM" Sydney-local -> "HH:MM" UTC, before saving. Known limitation: a tenant who never reopens the modal after a DST transition keeps the old UTC value, shifting their local send time by an hour — inherent to storing plain "HH:MM", not solved here. */
export function sydneyTimeToUtc(sydneyHhmm: string, referenceDate: Date = new Date()): string {
  const [h, m] = sydneyHhmm.split(":").map(Number);
  const refUtc = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate(), h, m),
  );
  const offset = sydneyOffsetMinutes(refUtc);
  return formatHhmm(h * 60 + m - offset);
}
