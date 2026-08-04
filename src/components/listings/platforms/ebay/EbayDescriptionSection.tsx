import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EbayListingFormState } from "@/types/marketplace";
import type { Attachment, ProductVehicle } from "@/types/product";
import { generateListingHtml } from "./ebayDescriptionGenerator";
import { getTenantSettings } from "@/lib/api/tenantSettings";
import { Eye } from "lucide-react";

interface Props {
  form: EbayListingFormState;
  vehicle: ProductVehicle | null | undefined;
  // Product/variant photos to show in the preview when this listing has no
  // photo_overrides of its own — display only, never saved onto the listing.
  fallbackAttachments?: Attachment[];
}

export function EbayDescriptionSection({ form, vehicle, fallbackAttachments }: Props) {
  const { data: tenantSettingsData } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: getTenantSettings,
  });
  const tenant = tenantSettingsData?.data;

  // embedImages: true — this preview renders same-origin in our own
  // dashboard, so the real photo/logo load fine here (unlike the actual
  // eBay submission, see generateListingHtml's doc-comment).
  const fallbackImageUrl = fallbackAttachments?.[0]?.url;

  const html = useMemo(
    () =>
      generateListingHtml(form, vehicle, tenant?.company_name, tenant?.logo_url, {
        embedImages: true,
        fallbackImageUrl,
      }),
    [
      form.title_override,
      vehicle,
      form.item_specifics.mpn,
      form.store_sku,
      form.condition,
      form.condition_notes,
      tenant?.company_name,
      tenant?.logo_url,
      fallbackImageUrl,
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
    ],
  );

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
