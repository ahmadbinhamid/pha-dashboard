import { useMemo } from "react";
import type { EbayListingFormState } from "@/types/marketplace";
import { generateListingHtml } from "./ebay-description-generator";
import { Eye } from "lucide-react";

interface Props {
  form: EbayListingFormState;
}

export function EbayDescriptionSection({ form }: Props) {
  const html = useMemo(() => generateListingHtml(form), [
    form.title_override,
    form.vehicle_make,
    form.vehicle_model,
    form.vehicle_model_code,
    form.vehicle_year,
    form.item_specifics.mpn,
    form.store_sku,
    form.condition,
    form.condition_notes,
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

      <div className="overflow-hidden rounded-xs border border-border" style={{ height: 640 }}>
        <iframe
          srcDoc={html}
          title="eBay Listing Description Preview"
          className="h-full w-full"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
