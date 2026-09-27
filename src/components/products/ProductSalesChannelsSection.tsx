import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { SkeletonText } from "@/components/ui/Skeleton";
import { SalesChannelRow } from "@/components/channels/SalesChannelRow";
import { getProductMappedCategories } from "@/lib/api/categoryMappings";
import { useProductChannelListings } from "@/hooks/useProductChannelListings";
import type { ListingProductDefaults } from "@/types/marketplace";
import type { Product } from "@/types/product";

interface Props {
  product: Product;
  // Last save time, so rows show "Syncing…" until channels catch up.
  syncingSince: number | null;
  // Channel whose settings drawer opens on arrival (from a redirected link).
  focusChannel?: string | null;
}

// Lists the product on each channel; channels only add what they can't derive.
export function ProductSalesChannelsSection({ product, syncingSince, focusChannel }: Props) {
  const { channels, baseListing, variantListingCount, isLoading } = useProductChannelListings(product._id, syncingSince);
  const { data: mappedRes } = useQuery({
    queryKey: ["product-mapped-categories", product._id],
    queryFn: () => getProductMappedCategories(product._id),
  });

  const productDefaults: ListingProductDefaults = {
    title: product.title,
    price: product.price ?? null,
    photos: product.attachments ?? [],
  };

  return (
    <Card>
      <div className="flex items-baseline gap-2 border-b border-border p-5">
        <h3 className="text-sm font-semibold text-fg">Sales channels</h3>
        <span className="ml-auto text-xs text-fg/45">Saving the product resyncs every ticked channel in ~5–10s</span>
      </div>
      <div className="divide-y divide-border">
        {isLoading ? (
          <SkeletonText lines={3} className="p-5" />
        ) : channels.length === 0 ? (
          <p className="p-5 text-sm text-fg/55">No sales channels are available.</p>
        ) : (
          channels.map((channel, index) => (
            <SalesChannelRow
              key={channel.key}
              channel={channel}
              index={index}
              product={product}
              productDefaults={productDefaults}
              listingSummary={baseListing(channel.key)}
              mappedCategory={mappedRes?.data?.[channel.key] ?? null}
              syncingSince={syncingSince}
              defaultOpen={focusChannel === channel.key}
            />
          ))
        )}
        {variantListingCount > 0 && (
          <p className="p-5 text-xs text-fg/55">
            {variantListingCount} variant listing{variantListingCount === 1 ? "" : "s"} for this product are managed on the Listings page.
          </p>
        )}
      </div>
    </Card>
  );
}
