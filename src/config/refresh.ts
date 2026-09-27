// How often a page left open re-pulls its data. Only Dashboard and Reports use this (screens left on a second monitor); everything else refetches on navigation, which is enough.
// `refetchIntervalInBackground` defaults to false, so a backgrounded tab's timer suspends — an hour-idle tab shows stale figures until the next tick, which the manual refresh control covers.
export const PAGE_REFETCH_MS = 5 * 60 * 1000;
