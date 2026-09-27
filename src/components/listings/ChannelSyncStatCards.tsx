import { useSearchParams } from "react-router-dom";
import { Blocks, CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { LISTING_FAILURES_STATUS, LISTING_STATUS_FILTER_ALL, type ListingStatusFilter } from "@/config/listingStatus";
import { channelListingTotals } from "@/lib/marketplace/channelListingSummary";
import { pluralize } from "@/utils/format";
import type { ChannelSummary } from "@/types/channel";

interface ChannelSyncStatCardsProps {
  channels: ChannelSummary[];
  loading?: boolean;
}

// Each card filters the table below by its status (via the URL).
export function ChannelSyncStatCards({ channels, loading }: ChannelSyncStatCardsProps) {
  const [, setSearchParams] = useSearchParams();
  const totals = channelListingTotals(channels);
  const showStatus = (status: ListingStatusFilter) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("status", status);
        next.set("page", "1");
        return next;
      },
      { replace: true },
    );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        size="sm"
        label="Total Listings"
        value={totals.total}
        subLabel={`Across ${pluralize(channels.length, "channel")}`}
        icon={<Blocks className="h-4 w-4" />}
        loading={loading}
        onClick={() => showStatus(LISTING_STATUS_FILTER_ALL)}
      />
      <MetricCard
        size="sm"
        label="Synced"
        value={totals.synced}
        subLabel="Live and up to date"
        icon={<CircleCheck className="h-4 w-4" />}
        tone="ok"
        loading={loading}
        onClick={() => showStatus("synced")}
      />
      <MetricCard
        size="sm"
        label="Pending"
        value={totals.pending}
        subLabel="Waiting to sync"
        icon={<Clock className="h-4 w-4" />}
        loading={loading}
        onClick={() => showStatus("pending")}
      />
      <MetricCard
        size="sm"
        label="Needs Attention"
        value={totals.needsAttention}
        subLabel={totals.needsAttention ? "Failed or price-locked" : "No failures"}
        icon={<TriangleAlert className="h-4 w-4" />}
        tone={totals.needsAttention ? "danger" : "ok"}
        loading={loading}
        onClick={() => showStatus(LISTING_FAILURES_STATUS)}
      />
    </div>
  );
}
