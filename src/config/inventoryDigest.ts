import type { DigestFrequency } from "@/types/inventory";
import { formatOrdinal } from "@/utils/format";

// Mirrors server constants/inventory.constants.js.
export const DIGEST_MONTH_DAY_MAX = 28;

export const DIGEST_FREQUENCY_OPTIONS: { value: DigestFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

// Monday first, as Australian calendars show it; values are JS weekdays.
export const DIGEST_WEEKDAY_OPTIONS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "0", label: "Sunday" },
];

export const DIGEST_MONTH_DAY_OPTIONS = Array.from({ length: DIGEST_MONTH_DAY_MAX }, (_, i) => ({
  value: String(i + 1),
  label: formatOrdinal(i + 1),
}));
