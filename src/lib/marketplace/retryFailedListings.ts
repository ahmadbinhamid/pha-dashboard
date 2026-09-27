import { getChannelLogs, retryChannelLog } from "@/lib/api/channels";
import { mapWithConcurrency } from "@/utils/mapWithConcurrency";
import type { AnyMarketplaceListing } from "@/types/marketplace";

// Small burst: each retry is 2 requests plus a real platform push.
const RETRY_CONCURRENCY = 4;

export interface RetryFailure {
  listing: AnyMarketplaceListing;
  reason: string;
}

export interface RetryOutcome {
  retried: AnyMarketplaceListing[];
  failed: RetryFailure[];
}

// Retry via the newest failure log (the endpoint is keyed by log id).
async function retryListing(listing: AnyMarketplaceListing) {
  const { data } = await getChannelLogs(listing.platform, { entity_id: listing._id, status: "failure", limit: 1 });
  const log = data.items[0];
  // NOTE: a missing (expired) log is reported, not silently re-pushed.
  if (!log) throw new Error("No failure log to retry (it may have expired); use Re-sync");
  await retryChannelLog(listing.platform, log._id);
}

export async function retryFailedListings(listings: AnyMarketplaceListing[]): Promise<RetryOutcome> {
  const settled = await mapWithConcurrency(listings, RETRY_CONCURRENCY, retryListing);
  const outcome: RetryOutcome = { retried: [], failed: [] };
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") outcome.retried.push(listings[i]);
    else outcome.failed.push({ listing: listings[i], reason: (result.reason as Error)?.message ?? "Retry failed" });
  });
  return outcome;
}
