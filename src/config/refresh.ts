// How often a page that's left open re-pulls its data.
//
// Only the Dashboard and Reports use this: they're the two screens someone
// leaves up on a second monitor, where a figure going stale is the whole
// problem. Everything else refetches when it's navigated to, which is enough.
//
// Note what TanStack Query does with an interval while the tab is in the
// background: `refetchIntervalInBackground` defaults to false, so the timer is
// suspended rather than firing into a hidden tab. Coming back to a tab that
// sat idle for an hour therefore shows the last-known figures until the next
// tick — which is the case a manual refresh control exists to cover.
export const PAGE_REFETCH_MS = 5 * 60 * 1000;
