// Bounded, sane range for a vehicle model year, matching the old free-text inputs' 1900-2100 enforcement but as a real list, not a violable validation range. Newest first to minimize scrolling for the common case.
const MIN_VEHICLE_YEAR = 1900;
const MAX_VEHICLE_YEAR = new Date().getFullYear() + 1;

export const VEHICLE_YEAR_OPTIONS: string[] = Array.from(
  { length: MAX_VEHICLE_YEAR - MIN_VEHICLE_YEAR + 1 },
  (_, i) => String(MAX_VEHICLE_YEAR - i),
);
