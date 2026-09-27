import type { ChannelSummary } from "@/types/channel";

export interface ChannelListingTotals {
  total: number;
  synced: number;
  pending: number;
  needsAttention: number;
}

/** Listing counts summed over every channel, for the sync page's cards. */
export function channelListingTotals(channels: ChannelSummary[]): ChannelListingTotals {
  return channels.reduce<ChannelListingTotals>(
    (totals, channel) => {
      const counts = channel.listing_counts ?? {};
      totals.total += Object.values(counts).reduce((sum, n) => sum + n, 0);
      totals.synced += counts.synced ?? 0;
      totals.pending += counts.pending ?? 0;
      totals.needsAttention += channel.needs_attention_count ?? 0;
      return totals;
    },
    { total: 0, synced: 0, pending: 0, needsAttention: 0 },
  );
}
