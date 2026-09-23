import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, ShoppingCart, Boxes, History } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Input } from "@/components/ui/Input";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { PageHeader } from "@/components/shared/PageHeader";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ActivityLogTable } from "@/components/activity/ActivityLogTable";
import { listActivityLog, getActivityAnalytics } from "@/lib/api/dashboard";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import type { DateRangeValue } from "@/utils/dateRange";
import type { ActivityEventType } from "@/types/dashboard";

const TYPE_FILTERS: { label: string; value: ActivityEventType | "" }[] = [
  { label: "All Activity", value: "" },
  { label: "Orders", value: "order" },
  { label: "Stock Changes", value: "stock" },
];

export default function ActivityLogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const type = (searchParams.get("type") ?? "") as ActivityEventType | "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10);

  // Free-text search stays out of the URL and is debounced locally; synced filters are worth deep-linking, a half-typed search mid-keystroke isn't.
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const setPage = useCallback(
    (p: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("page", String(p));
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const updateFilter = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        next.set("page", "1");
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  // Sets from/to together in one history entry — two sequential updateFilter calls could race.
  const updateDateRange = useCallback(
    (range: DateRangeValue) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (range.from) next.set("from", range.from);
        else next.delete("from");
        if (range.to) next.set("to", range.to);
        else next.delete("to");
        next.set("page", "1");
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const setLimit = useCallback(
    (l: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("limit", String(l));
        next.set("page", "1");
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  // Compares against the previous value, not a one-shot mounted flag, to stay idempotent under StrictMode's double-invoke — a flag wrongly fired setPage twice, needing two Back clicks to leave.
  const prevSearchRef = useRef(debouncedSearch);
  useEffect(() => {
    if (prevSearchRef.current === debouncedSearch) return;
    prevSearchRef.current = debouncedSearch;
    setPage(1);
  }, [debouncedSearch, setPage]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["dashboard", "activity-log", { type, from, to, search: debouncedSearch, page, limit }],
    queryFn: () =>
      listActivityLog({
        type: type || undefined,
        from: from || undefined,
        to: to || undefined,
        search: debouncedSearch || undefined,
        page,
        limit,
      }),
  });

  const { data: analyticsRes, isLoading: analyticsLoading } = useQuery({
    queryKey: ["dashboard", "activity-log", "analytics", { from, to }],
    queryFn: () => getActivityAnalytics({ from: from || undefined, to: to || undefined }),
  });

  const events = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 1;
  const analytics = analyticsRes?.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Log"
        description="Every order and inventory change across your store, newest first"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total Events"
          value={analytics?.totalEvents ?? 0}
          subLabel={from || to ? "In selected range" : "Last 14 days"}
          icon={<Activity className="h-3.5 w-3.5" />}
          size="sm"
          loading={analyticsLoading}
        />
        <MetricCard
          label="Orders"
          value={analytics?.orderEvents ?? 0}
          icon={<ShoppingCart className="h-3.5 w-3.5" />}
          size="sm"
          loading={analyticsLoading}
        />
        <MetricCard
          label="Stock Changes"
          value={analytics?.stockEvents ?? 0}
          icon={<Boxes className="h-3.5 w-3.5" />}
          size="sm"
          loading={analyticsLoading}
        />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="search"
              placeholder="Search order #, customer, product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-64 sm:w-80 lg:w-96"
            />
            <FilterSelect options={TYPE_FILTERS} value={type} onChange={(v) => updateFilter("type", v)} />
          </div>

          {/* Date range sits opposite the text filters: "what" on the left, "over what period" on the right. Fetch hint rides with it rather than shifting the picker. */}
          <div className="flex items-center gap-3">
            {isFetching && !isLoading && <span className="text-xs text-fg/40">Updating…</span>}
            <DateRangePicker
              value={{ from: from || undefined, to: to || undefined }}
              onChange={updateDateRange}
              placeholder="Last 14 days"
              allowClear
            />
          </div>
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : events.length === 0 ? (
          <EmptyState />
        ) : (
          <ActivityLogTable events={events} />
        )}

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={limit}
          onLimitChange={setLimit}
          isLoading={isFetching}
          onPageChange={setPage}
        />
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-border/60">
      {[220, 260, 180, 240, 200, 150].map((w, i) => (
        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
          <div className="h-3.5 w-28 animate-pulse rounded-xs bg-bg-2" />
          <div className="h-7 w-7 shrink-0 animate-pulse rounded-lg bg-bg-2" />
          <div className="h-3.5 animate-pulse rounded-xs bg-bg-2" style={{ width: w }} />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xs border border-border bg-bg-2">
        <History className="h-8 w-8 text-fg/30" />
      </div>
      <div>
        <p className="font-medium text-fg">No activity found</p>
        <p className="mt-1 text-sm text-fg/50">Try widening your filters or date range.</p>
      </div>
    </div>
  );
}
