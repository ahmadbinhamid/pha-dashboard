import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListingQueueTable } from "@/components/listings/listing-queue-table";

export default function ListingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Listings</h1>
        <p className="mt-1 text-sm text-fg/70">
          Channel listings (eBay, Shopify) with sync status and content optimization.
        </p>
      </div>

      <ListingQueueTable />

      <Card>
        <CardHeader title="Listings" description="This is a UI stub you can wire to real listing data later." />
        <CardContent>
          <EmptyState
            title="No live listings connected yet"
            description="Connect eBay in Settings to enable real listing sync and management."
            actionLabel="Go to Settings"
            actionHref="/settings"
          />
        </CardContent>
      </Card>
    </div>
  );
}

