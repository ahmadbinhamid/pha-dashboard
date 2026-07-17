import { Badge } from "@/components/ui/badge";
import type { EbayListing } from "@/types/marketplace";
import { LISTING_SYNC_STATUS_CONFIG } from "@/config/listing-status";

interface Props {
  listing?: EbayListing | null;
}

export function EbaySyncStatusSection({ listing }: Props) {
  const statusCfg = LISTING_SYNC_STATUS_CONFIG[listing?.sync_status ?? "not_listed"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <p className="text-xs text-fg/60">Listing Status</p>
          <Badge variant={statusCfg.variant} className="mt-1">
            {statusCfg.label}
          </Badge>
        </div>

        <div>
          <p className="text-xs text-fg/60">Last Synced</p>
          <p className="mt-1 text-sm font-medium text-fg">
            {listing?.synced_at
              ? new Date(listing.synced_at).toLocaleString("en-AU")
              : "N/A"}
          </p>
        </div>

        {listing?.external_listing_id && (
          <div>
            <p className="text-xs text-fg/60">eBay Item ID</p>
            <p className="mt-1 text-sm font-medium text-fg">
              {listing.external_listing_id}
            </p>
          </div>
        )}

        {listing?.external_listing_id && (
          <a
            href={`https://www.ebay.com.au/itm/${listing.external_listing_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            View on eBay
          </a>
        )}
      </div>

      {listing?.sync_error && (
        <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          <span className="font-medium">Sync error: </span>{listing.sync_error}
        </div>
      )}

      <div className="rounded-md bg-muted/50 px-3 py-2 text-sm text-fg/70">
        Saving will store to local inventory. Use{" "}
        <strong>Save &amp; Push to eBay</strong> to create or update the live
        eBay listing.
      </div>
    </div>
  );
}
