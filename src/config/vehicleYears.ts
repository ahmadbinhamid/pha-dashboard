// Bounded, sane range for a vehicle model year — matches the min/max the
// old free-text year inputs enforced (1900-2100), but as a real bounded
// list rather than a validation range a text input could still violate.
// Newest first: the vehicle being fitted is far more likely to be recent
// than from 1900, so this minimizes scrolling for the common case.
const MIN_VEHICLE_YEAR = 1900;
const MAX_VEHICLE_YEAR = new Date().getFullYear() + 1;

export const VEHICLE_YEAR_OPTIONS: string[] = Array.from(
  { length: MAX_VEHICLE_YEAR - MIN_VEHICLE_YEAR + 1 },
  (_, i) => String(MAX_VEHICLE_YEAR - i),
);
