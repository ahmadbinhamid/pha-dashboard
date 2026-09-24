import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetTitle, SheetDescription } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { getChannelLogs } from "@/lib/api/channels";
import { PLATFORM_LABEL } from "@/config/marketplacePlatforms";
import type { AnyMarketplaceListing } from "@/types/marketplace";
import type { ChannelSyncLogStatus } from "@/types/channel";

const LOG_LIMIT = 50;

const STATUS_VARIANT: Record<ChannelSyncLogStatus, "ok" | "danger" | "muted"> = {
  success: "ok",
  failure: "danger",
  skipped: "muted",
};

interface ListingSyncLogSheetProps {
  listing: AnyMarketplaceListing | null;
  onClose: () => void;
}

// One listing's sync log, newest first (successes only if server logs them).
export function ListingSyncLogSheet({ listing, onClose }: ListingSyncLogSheetProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["channel-logs", listing?.platform, listing?._id],
    queryFn: () => getChannelLogs(listing!.platform, { entity_id: listing!._id, limit: LOG_LIMIT }),
    enabled: !!listing,
  });
  const logs = data?.data?.items ?? [];
  const title = listing && typeof listing.product === "object" && listing.product ? listing.product.title : "Listing";

  return (
    <Sheet open={!!listing} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="max-w-[560px] bg-card">
        <SheetHeader className="pr-12">
          <SheetTitle className="truncate">{title}</SheetTitle>
          <SheetDescription className="text-xs">
            {listing ? `${PLATFORM_LABEL[listing.platform] ?? listing.platform} sync log` : null}
            {data?.data && data.data.total > LOG_LIMIT ? ` · latest ${LOG_LIMIT} of ${data.data.total}` : null}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-3">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
          ) : isError ? (
            <p className="text-sm text-danger">Couldn&apos;t load the sync log.</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-fg/55">No log entries. Older entries expire automatically.</p>
          ) : (
            logs.map((log) => (
              <div key={log._id} className="space-y-1.5 rounded-xl border border-border bg-bg p-3">
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant={STATUS_VARIANT[log.status] ?? "muted"}>{log.status}</Badge>
                  <span className="font-medium text-fg">{log.job_type}</span>
                  {log.attempt > 1 && <span className="text-fg/50">attempt {log.attempt}</span>}
                  <span className="ml-auto text-fg/50">{new Date(log.created_at).toLocaleString("en-AU")}</span>
                </div>
                {log.error_code && <p className="font-mono text-xs text-fg/60">{log.error_code}</p>}
                {log.error_message && <p className="whitespace-pre-wrap break-words text-sm text-danger">{log.error_message}</p>}
              </div>
            ))
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
