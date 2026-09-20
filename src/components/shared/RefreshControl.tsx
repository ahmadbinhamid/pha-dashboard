import { useCallback, useEffect, useState } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

// "Updated 3m ago" + a refresh button, for the pages that auto-refetch on a
// timer (Dashboard, Reports — see config/refresh.ts).
//
// Both halves earn their place:
//   * The timestamp is the only way to tell a figure from 10 seconds ago from
//     one from an hour ago. It matters most after a tab has been in the
//     background, where TanStack suspends the interval entirely, so the page
//     can be arbitrarily out of date with nothing on screen saying so.
//   * The button re-pulls everything at once, for the "I just recorded a
//     payment, show me" case that a timer can't answer.
//
// Takes a LIST of key prefixes because a page's data isn't always under one
// root: Reports reads six /reports endpoints plus the dashboard's stats.
//
// Age and busy state are both read from the query cache rather than tracked
// here, so they stay honest when a refetch happens for some other reason (a
// timer tick, a mutation invalidating the key, a component mounting).
const AGE_TICK_MS = 30_000;

function formatAge(updatedAt: number | null) {
  if (!updatedAt) return null;
  const minutes = Math.floor((Date.now() - updatedAt) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function RefreshControl({
  queryKeys,
  className,
  label = "Updated",
}: {
  /** Key prefixes covering the page's queries, e.g. [["reports"], ["dashboard", "stats"]]. */
  queryKeys: QueryKey[];
  className?: string;
  label?: string;
}) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<{ updatedAt: number | null; fetching: boolean }>({
    updatedAt: null,
    fetching: false,
  });
  // Re-renders on the half minute so a stale timestamp doesn't sit there
  // reading "just now" while the page ages.
  const [, setTick] = useState(0);

  // Serialized, so a caller can pass an inline array literal without the
  // effect below re-subscribing on every render.
  const keysSignature = JSON.stringify(queryKeys);

  useEffect(() => {
    const keys = JSON.parse(keysSignature) as QueryKey[];

    const read = () => {
      const queries = keys.flatMap((queryKey) => queryClient.getQueryCache().findAll({ queryKey }));
      const stamps = queries.map((query) => query.state.dataUpdatedAt).filter(Boolean);
      setState({
        updatedAt: stamps.length ? Math.max(...stamps) : null,
        fetching: queries.some((query) => query.state.fetchStatus === "fetching"),
      });
    };

    read();
    const unsubscribe = queryClient.getQueryCache().subscribe(read);
    const timer = setInterval(() => setTick((t) => t + 1), AGE_TICK_MS);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [queryClient, keysSignature]);

  const refresh = useCallback(() => {
    const keys = JSON.parse(keysSignature) as QueryKey[];
    for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
  }, [queryClient, keysSignature]);

  const age = formatAge(state.updatedAt);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {age ? (
        <span className="hidden whitespace-nowrap text-xs text-fg/45 sm:inline">
          {label} {state.fetching ? "…" : age}
        </span>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={state.fetching}
        onClick={refresh}
        aria-label="Refresh data"
        title="Refresh data"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", state.fetching && "animate-spin")} />
        <span className="hidden sm:inline">Refresh</span>
      </Button>
    </div>
  );
}
