import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { FormSection } from "@/components/products/FormSection";
import { SalesChannelRow } from "@/components/channels/SalesChannelRow";
import { SkeletonText } from "@/components/ui/Skeleton";
import { getChannels } from "@/lib/api/channels";
import { getListings } from "@/lib/api/listings";
import { getProductMappedCategories } from "@/lib/api/categoryMappings";
import type { AnyMarketplaceListing, ListingProductDefaults } from "@/types/marketplace";
import type { Product } from "@/types/product";
import { SALES_CHANNELS_ANCHOR } from "@/config/salesChannels";

interface Props {
  number: number;
  product: Product;
  // Channel key to open on arrival, e.g. from a redirected /listings/:id/edit link.
  focusChannel?: string | null;
  focus?: boolean;
}

// The product is the source of truth: each channel only adds what it can't derive from it.
export function ProductSalesChannelsSection({ number, product, focusChannel, focus = false }: Props) {
  const anchorRef = useRef<HTMLDivElement>(null);

  // Same queryKey as the Listings/Settings pages, so this shares their cache.
  const { data: channelsRes, isLoading: channelsLoading } = useQuery({ queryKey: ["channels"], queryFn: getChannels });
  const { data: listingsRes, isLoading: listingsLoading } = useQuery({
    queryKey: ["listings", "product", product._id],
    queryFn: () => getListings({ product: product._id, limit: 100 }),
  });
  const { data: mappedRes } = useQuery({
    queryKey: ["product-mapped-categories", product._id],
    queryFn: () => getProductMappedCategories(product._id),
  });

  useEffect(() => {
    if (focus || focusChannel) anchorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus, focusChannel]);

  const channels = channelsRes?.data ?? [];
  const listings: AnyMarketplaceListing[] = listingsRes?.data?.items ?? [];
  // The product form manages each channel's base listing; variant listings stay on the Listings page.
  const baseListing = (platform: string) => listings.find((l) => l.platform === platform && !l.variant) ?? null;
  const variantListingCount = listings.filter((l) => l.variant).length;

  const productDefaults: ListingProductDefaults = {
    title: product.title,
    price: product.price ?? null,
    photos: product.attachments ?? [],
  };

  return (
    <div id={SALES_CHANNELS_ANCHOR} ref={anchorRef} className="scroll-mt-28">
      <FormSection
        number={number}
        title="Sales channels"
        description="Tick a channel to list this product there. Product edits reach every ticked channel automatically."
        contentClassName="divide-y divide-border/60 py-1"
      >
        {channelsLoading || listingsLoading ? (
          <SkeletonText lines={3} className="py-3" />
        ) : channels.length === 0 ? (
          <p className="py-3 text-sm text-fg/55">No sales channels are available.</p>
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
              defaultOpen={focusChannel === channel.key}
            />
          ))
        )}
        {variantListingCount > 0 && (
          <p className="py-3 text-xs text-fg/55">
            {variantListingCount} variant listing{variantListingCount === 1 ? "" : "s"} for this product are managed on the Listings page.
          </p>
        )}
      </FormSection>
    </div>
  );
}
