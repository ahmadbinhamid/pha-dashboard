import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { SyncBadge } from "@/components/listings/SyncBadge";
import { ListingRowActionsMenu } from "@/components/listings/ListingRowActionsMenu";
import { ListingSyncLogSheet } from "@/components/listings/ListingSyncLogSheet";
import { ListingRetryResultCard } from "@/components/listings/ListingRetryResultCard";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { PLATFORM_LABEL } from "@/config/marketplacePlatforms";
import { LISTING_SYNC_STATUS_CONFIG } from "@/config/listingStatus";
import { productChannelsPath } from "@/config/salesChannels";
import { getChannelLogo } from "@/components/channels/channelLogos";
import { getListings, pushListing } from "@/lib/api/listings";
import { retryFailedListings, type RetryOutcome } from "@/lib/marketplace/retryFailedListings";
import { formatRelativeTime } from "@/utils/formatRelativeTime";
import { useToast } from "@/context";
import type { ChannelSummary } from "@/types/channel";
import type { AnyMarketplaceListing, ListingSyncStatus } from "@/types/marketplace";
import { Search, CheckCircle2, RefreshCw } from "lucide-react";

// No status param means failures; "all" is the explicit opt-out.
const DEFAULT_STATUS: ListingSyncStatus = "error";
const ALL_STATUSES = "all";

const STATUS_FILTERS = [
  { label: "All statuses", value: "" },
  ...(Object.entries(LISTING_SYNC_STATUS_CONFIG) as [ListingSyncStatus, { label: string }][]).map(([value, cfg]) => ({
    label: value === DEFAULT_STATUS ? "Failures" : cfg.label,
    value,
  })),
];

function productOf(listing: AnyMarketplaceListing) {
  return typeof listing.product === "object" && listing.product ? listing.product : null;
}

// Sync monitor: one row per listing with sync state and error; no edits.
export function ChannelSyncTable({ channels }: { channels: ChannelSummary[] }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const platform = searchParams.get("platform") ?? "";
  const statusParam = searchParams.get("status") ?? DEFAULT_STATUS;
  const syncStatus = statusParam === ALL_STATUSES ? "" : statusParam;
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? String(DEFAULT_PAGE_SIZE), 10);

  const [inputValue, setInputValue] = useState(search);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [logTarget, setLogTarget] = useState<AnyMarketplaceListing | null>(null);
  const [retryOutcome, setRetryOutcome] = useState<RetryOutcome | null>(null);

  const platformFilters = [{ label: "All channels", value: "" }, ...channels.map((c) => ({ label: c.name, value: c.key }))];

  const updateParams = useCallback(
    (changes: Record<string, string | null>, resetPage = true) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value);
          else next.delete(key);
        }
        if (resetPage) next.set("page", "1");
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue !== (searchParams.get("search") ?? "")) updateParams({ search: inputValue || null });
    }, 400);
    return () => clearTimeout(timer);
  }, [inputValue, searchParams, updateParams]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["listings", "sync-monitor", { page, limit, platform, syncStatus, search }],
    queryFn: () =>
      getListings({
        page,
        limit,
        ...(platform ? { platform: platform as AnyMarketplaceListing["platform"] } : {}),
        ...(syncStatus ? { sync_status: syncStatus } : {}),
        ...(search ? { search } : {}),
      }),
  });

  const listings: AnyMarketplaceListing[] = data?.data?.items ?? [];
  const failedOnPage = listings.filter((l) => l.sync_status === "error");
  const selectedListings = failedOnPage.filter((l) => selected.has(l._id));
  const allFailedSelected = failedOnPage.length > 0 && selectedListings.length === failedOnPage.length;

  // Per page/filter, so a stale id from another view is never retried.
  useEffect(() => setSelected(new Set()), [page, limit, platform, syncStatus, search]);

  const resyncMutation = useMutation({
    mutationFn: (listing: AnyMarketplaceListing) => pushListing(listing._id),
    onSuccess: (_data, listing) => {
      toast({ title: `Queued for ${PLATFORM_LABEL[listing.platform] ?? listing.platform} sync`, tone: "success" });
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
    onError: (err: Error) => toast({ title: err.message, tone: "danger" }),
  });

  const retryMutation = useMutation({
    mutationFn: retryFailedListings,
    onSuccess: (outcome) => {
      setRetryOutcome(outcome);
      // Keep failures selected so they can be retried again after a fix.
      setSelected(new Set(outcome.failed.map((f) => f.listing._id)));
      void queryClient.invalidateQueries({ queryKey: ["listings"] });
    },
  });

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {retryOutcome && <ListingRetryResultCard outcome={retryOutcome} onDismiss={() => setRetryOutcome(null)} />}

      <Card>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
            <Input placeholder="Search listings…" value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isFetching && !isLoading && <span className="text-xs text-fg/40">Updating…</span>}
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="gap-1.5"
              disabled={selectedListings.length === 0 || retryMutation.isPending}
              onClick={() => retryMutation.mutate(selectedListings)}
            >
              <RefreshCw className={retryMutation.isPending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              {retryMutation.isPending ? "Retrying…" : `Retry selected${selectedListings.length ? ` (${selectedListings.length})` : ""}`}
            </Button>
            <SingleSelect size="sm" options={platformFilters} value={platform} onChange={(v) => updateParams({ platform: v || null })} />
            <SingleSelect
              size="sm"
              options={STATUS_FILTERS}
              value={syncStatus}
              onChange={(v) => updateParams({ status: v === DEFAULT_STATUS ? null : v || ALL_STATUSES })}
            />
          </div>
        </div>

        {isLoading ? (
          <SyncTableSkeleton />
        ) : listings.length === 0 ? (
          <SyncTableEmptyState failuresOnly={syncStatus === DEFAULT_STATUS} onShowAll={() => updateParams({ status: ALL_STATUSES })} />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-220">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Select all failed listings on this page"
                      size="sm"
                      checked={allFailedSelected}
                      disabled={failedOnPage.length === 0}
                      onChange={(e) => setSelected(e.target.checked ? new Set(failedOnPage.map((l) => l._id)) : new Set())}
                    />
                  </TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead>Last synced</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listings.map((listing) => {
                  const product = productOf(listing);
                  const PlatformLogo = getChannelLogo(listing.platform);
                  const failed = listing.sync_status === "error";
                  return (
                    <TableRow key={listing._id}>
                      <TableCell>
                        {failed && (
                          <Checkbox
                            aria-label={`Select ${product?.title ?? "listing"}`}
                            size="sm"
                            checked={selected.has(listing._id)}
                            onChange={(e) => toggle(listing._id, e.target.checked)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="max-w-56 truncate font-medium text-fg">{product?.title ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-fg/70">
                        <span className="inline-flex items-center" title={PLATFORM_LABEL[listing.platform] ?? listing.platform}>
                          {PlatformLogo ? <PlatformLogo className="h-5 w-5 shrink-0" /> : PLATFORM_LABEL[listing.platform] ?? listing.platform}
                        </span>
                      </TableCell>
                      <TableCell>
                        <SyncBadge status={listing.sync_status} />
                      </TableCell>
                      <TableCell className="max-w-96">
                        {listing.sync_error ? (
                          <p className="line-clamp-2 whitespace-normal break-words text-xs text-danger" title={listing.sync_error}>
                            {listing.sync_error}
                          </p>
                        ) : (
                          <span className="text-fg/40">—</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-fg/60" title={listing.synced_at ? new Date(listing.synced_at).toLocaleString("en-AU") : undefined}>
                        {formatRelativeTime(listing.synced_at) ?? "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <ListingRowActionsMenu
                          onViewProduct={product ? () => navigate(productChannelsPath(product.slug, listing.platform)) : null}
                          onResync={() => resyncMutation.mutate(listing)}
                          resyncDisabled={resyncMutation.isPending}
                          onViewLog={() => setLogTarget(listing)}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <Pagination
          currentPage={page}
          totalPages={data?.data?.totalPages ?? 1}
          totalItems={data?.data?.total ?? 0}
          itemsPerPage={limit}
          onLimitChange={(l) => updateParams({ limit: String(l) })}
          isLoading={isFetching}
          onPageChange={(p) => updateParams({ page: String(p) }, false)}
        />
      </Card>

      <ListingSyncLogSheet listing={logTarget} onClose={() => setLogTarget(null)} />
    </div>
  );
}

function SyncTableSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="h-4 w-4 animate-pulse rounded bg-bg-2" />
          <div className="h-4 w-40 animate-pulse rounded bg-bg-2" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-bg-2" />
          <div className="h-4 w-56 animate-pulse rounded bg-bg-2" />
          <div className="ml-auto h-7 w-7 animate-pulse rounded bg-bg-2" />
        </div>
      ))}
    </div>
  );
}

function SyncTableEmptyState({ failuresOnly, onShowAll }: { failuresOnly: boolean; onShowAll: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-xs border border-border bg-bg-2">
        <CheckCircle2 className="h-8 w-8 text-ok" />
      </div>
      <div>
        <p className="font-medium text-fg">{failuresOnly ? "No sync failures" : "No listings match this filter"}</p>
        <p className="mt-1 text-sm text-fg/50">
          {failuresOnly ? "No listings are in an error state." : "Try a different channel or status."}
        </p>
      </div>
      {failuresOnly && (
        <Button type="button" variant="secondary" size="sm" onClick={onShowAll}>
          Show all listings
        </Button>
      )}
    </div>
  );
}
