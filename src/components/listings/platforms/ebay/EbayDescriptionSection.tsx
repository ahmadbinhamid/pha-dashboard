import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EbayListingFormState } from "@/types/marketplace";
import type { ProductVehicle } from "@/types/product";
import { generateListingHtml } from "./ebayDescriptionGenerator";
import { getEbaySettings } from "@/lib/api/ebay";
import { getTenantSettings } from "@/lib/api/tenantSettings";
import { Eye } from "lucide-react";

interface Props {
  form: EbayListingFormState;
  vehicle: ProductVehicle | null | undefined;
}

export function EbayDescriptionSection({ form, vehicle }: Props) {
  const { data: ebaySettingsData } = useQuery({
    queryKey: ["ebay-settings"],
    queryFn: getEbaySettings,
  });
  const ebaySettings = ebaySettingsData?.data;
  const sandboxFallbackImageUrl = ebaySettings?.sandbox ? ebaySettings.fallback_image_url : null;

  const { data: tenantSettingsData } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: getTenantSettings,
  });
  const tenant = tenantSettingsData?.data;

  const html = useMemo(() => generateListingHtml(form, vehicle, sandboxFallbackImageUrl, tenant?.company_name, tenant?.logo_url), [
    form.title_override,
    vehicle,
    form.item_specifics.mpn,
    form.store_sku,
    form.condition,
    form.condition_notes,
    sandboxFallbackImageUrl,
    tenant?.company_name,
    tenant?.logo_url,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(form.fitment),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(form.item_specifics.superseded_part_number),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(form.item_specifics.aspects),
    form.item_specifics.authenticity,
    form.item_specifics.warranty,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    form.photo_overrides?.[0]?.url,
  ]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xs border border-accent/20 bg-accent/5 px-3 py-2">
        <Eye className="h-3.5 w-3.5 shrink-0 text-accent" />
        <p className="text-xs text-fg/60">
          Auto-generated from your listing details — updates live as you fill in Title, Condition, MPN, SKU and Vehicle Fitment.
        </p>
      </div>

      <div className="rounded-xs border border-border" style={{ height: 640 }}>
        <iframe
          srcDoc={html}
          title="eBay Listing Description Preview"
          style={{ height: "100%", width: "100%", display: "block" }}
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
