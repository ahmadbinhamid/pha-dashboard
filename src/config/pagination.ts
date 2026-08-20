export const PER_PAGE_OPTIONS = [15, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 15;

// Divisible by 2/3/4 — matches the grid's responsive column counts so the
// last row fills evenly instead of leaving a lopsided gap.
export const PER_PAGE_OPTIONS_GRID = [12, 24, 48] as const;
export const DEFAULT_PAGE_SIZE_GRID = 12;
