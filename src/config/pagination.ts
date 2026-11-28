export const PER_PAGE_OPTIONS = [15, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 15;
export const SEARCH_DEBOUNCE_MS = 400;

// Divisible by 2, 3 and 4, so the grid's last row always fills evenly.
export const PER_PAGE_OPTIONS_GRID = [12, 24, 48] as const;
export const DEFAULT_PAGE_SIZE_GRID = 12;
