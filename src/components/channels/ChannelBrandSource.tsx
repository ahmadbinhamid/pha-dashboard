import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/Label";
import Link from "@/components/ui/Link";
import { getTenantSettings } from "@/lib/api/tenantSettings";
import { resolveChannelBrand } from "@/lib/marketplace/brandSource";
import { BRAND_SOURCE_LABEL } from "@/config/salesChannels";
import { cn } from "@/utils/cn";
import type { ChannelSummary } from "@/types/channel";
import type { Product } from "@/types/product";

const STORE_PROFILE_HREF = "/settings/store/general";

interface Props {
  channel: ChannelSummary;
  product: Product;
  // Per-channel listing override (eBay item specifics), if any.
  listingBrand?: string | null;
}

// Read-only brand row: the value this channel receives and where it came from.
export function ChannelBrandSource({ channel, product, listingBrand }: Props) {
  const { data } = useQuery({ queryKey: ["tenant-settings"], queryFn: getTenantSettings });
  const { brand, source } = resolveChannelBrand({
    listingBrand,
    productBrand: product.brand,
    defaultBrand: data?.data.default_brand,
    usesDefault: !!channel.uses_default_brand,
  });

  return (
    <div className="flex flex-col gap-1">
      <Label>Brand</Label>
      <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-bg-2 py-1 pl-3 pr-1">
        <span className={cn("text-compact font-medium", brand ? "text-fg" : "text-fg/50")}>{brand ?? "No brand"}</span>
        <span className="text-xs text-fg/55">
          {source === "listing" && BRAND_SOURCE_LABEL.listing(channel.name)}
          {source === "product" && (
            <>
              {BRAND_SOURCE_LABEL.product} ·{" "}
              <Link href="?tab=details" className="font-medium text-accent hover:underline">
                Edit in Details
              </Link>
            </>
          )}
          {source !== "listing" && source !== "product" && (
            <>
              {source === "store_default" ? `${BRAND_SOURCE_LABEL.store_default} · ` : "Set one on the product, or a "}
              <Link href={STORE_PROFILE_HREF} className="font-medium text-accent hover:underline">
                {source === "store_default" ? "Change in Store Settings" : "store default brand"}
              </Link>
            </>
          )}
        </span>
      </div>
    </div>
  );
}
