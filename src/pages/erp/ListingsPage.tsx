import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProductPickerModal } from "@/components/listings/ProductPickerModal";
import { ListingsTab } from "@/components/listings/ListingsTab";
import { getChannels } from "@/lib/api/channels";
import type { Product } from "@/types/product";
import { ArrowRight, Blocks, Plus } from "lucide-react";

// Split out of the old merged Products+Listings page — this is the flat,
// listing-centric view (every real MarketplaceListing row) as its own page.
// Fetches GET /channels here (shared ["channels"] query key — same one
// ProductsPage.tsx/GoogleConnectCard.tsx/ProductEditPage.tsx already use)
// so the "no channels connected" nudge and ListingsTab's own platform filter
// never hardcode a platform list.
export default function ListingsPage() {
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["channels"],
    queryFn: getChannels,
  });
  const channels = data?.data ?? [];

  function handleProductSelected(product: Product) {
    setPickerOpen(false);
    navigate(`/listings/new?product=${product._id}&productSlug=${product.slug}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Listings"
        description="Per-channel listing status and sync eBay, Google Shopping, and more."
      >
        <Button variant="primary" size="md" className="gap-2" onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4" />
          New Listing
        </Button>
      </PageHeader>

      {isLoading ? (
        <Skeleton className="h-11 w-full rounded-2xl" />
      ) : channels.length === 0 ? (
        // A blank strip here (nothing rendered, with nothing to explain why)
        // reads as a bug, not as "you haven't connected anything yet". This
        // is the one place on this page that says so and points at where to
        // fix it.
        <button
          type="button"
          onClick={() => navigate("/settings/integrations")}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-left transition-colors hover:border-accent/40 hover:bg-muted/40"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
            <Blocks className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-fg">No sales channels connected</span>
            <span className="block text-xs text-fg/50">Connect eBay or Google Shopping to start listing products.</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-fg/30" />
        </button>
      ) : null}

      <ListingsTab channels={channels} />

      <ProductPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleProductSelected} />
    </div>
  );
}
