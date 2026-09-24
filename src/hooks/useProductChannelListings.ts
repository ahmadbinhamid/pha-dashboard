import { useQuery } from "@tanstack/react-query";
import { getChannels } from "@/lib/api/channels";
import { getListings } from "@/lib/api/listings";
import type { AnyMarketplaceListing } from "@/types/marketplace";

// How long to poll after a save while channels pick up the change.
const SYNC_POLL_WINDOW_MS = 30_000;
const SYNC_POLL_INTERVAL_MS = 2_500;

// True while a listing hasn't synced since `since` (a save), in the window.
export function isAwaitingSync(listing: AnyMarketplaceListing, since: number | null) {
  if (!since || Date.now() - since > SYNC_POLL_WINDOW_MS) return false;
  return !listing.synced_at || new Date(listing.synced_at).getTime() < since;
}

// Channels plus this product's base listings; none until the product exists.
export function useProductChannelListings(productId: string | null, syncingSince: number | null = null) {
  const channelsQuery = useQuery({ queryKey: ["channels"], queryFn: getChannels });
  const listingsQuery = useQuery({
    queryKey: ["listings", "product", productId],
    queryFn: () => getListings({ product: productId!, limit: 100 }),
    enabled: !!productId,
    refetchInterval: (query) => {
      const items = query.state.data?.data?.items ?? [];
      return items.some((l) => isAwaitingSync(l, syncingSince)) ? SYNC_POLL_INTERVAL_MS : false;
    },
  });

  const listings = listingsQuery.data?.data?.items ?? [];
  const baseListings = listings.filter((l) => !l.variant);

  return {
    channels: channelsQuery.data?.data ?? [],
    listings,
    baseListings,
    baseListing: (platform: string) => baseListings.find((l) => l.platform === platform) ?? null,
    variantListingCount: listings.length - baseListings.length,
    isLoading: channelsQuery.isLoading || listingsQuery.isLoading,
  };
}
