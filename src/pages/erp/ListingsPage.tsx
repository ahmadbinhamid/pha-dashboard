import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProductPickerModal } from "@/components/listings/ProductPickerModal";
import { ListingsTab } from "@/components/listings/ListingsTab";
import { NoChannelsConnectedCard } from "@/components/channels/NoChannelsConnectedCard";
import { getChannels } from "@/lib/api/channels";
import type { Product } from "@/types/product";
import { Plus } from "lucide-react";
import { productChannelsPath } from "@/config/salesChannels";

// Split out of the old merged Products+Listings page: the flat, listing-centric view as its own page. Fetches GET /channels via the shared ["channels"] query key so the "no channels connected" nudge and ListingsTab's filter never hardcode a platform list.
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
    navigate(productChannelsPath(product.slug));
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
        <NoChannelsConnectedCard />
      ) : null}

      <ListingsTab channels={channels} />

      <ProductPickerModal open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={handleProductSelected} />
    </div>
  );
}
