import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PLATFORM_LABEL } from "@/config/marketplacePlatforms";
import type { RetryOutcome } from "@/lib/marketplace/retryFailedListings";

interface ListingRetryResultCardProps {
  outcome: RetryOutcome;
  onDismiss: () => void;
}

// Bulk-retry report: how many were queued, and each failure with its reason.
export function ListingRetryResultCard({ outcome, onDismiss }: ListingRetryResultCardProps) {
  const { retried, failed } = outcome;
  return (
    <Card className="space-y-2 p-4" role="status">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm font-medium text-fg">
          {retried.length} queued for retry
          {failed.length > 0 && <span className="text-danger"> · {failed.length} couldn&apos;t be retried</span>}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
      {failed.length > 0 && (
        <ul className="space-y-1 text-sm">
          {failed.map(({ listing, reason }) => (
            <li key={listing._id} className="text-fg/70">
              <span className="font-medium text-fg">
                {typeof listing.product === "object" && listing.product ? listing.product.title : listing._id}
              </span>{" "}
              ({PLATFORM_LABEL[listing.platform] ?? listing.platform}): <span className="text-danger">{reason}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
