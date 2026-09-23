import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { EbayListingFormState, ListingProductDefaults } from "@/types/marketplace";
import type { ProductVehicle } from "@/types/product";
import { Textarea } from "@/components/ui/Textarea";
import { OverrideField } from "@/components/listings/OverrideField";
import { generateListingHtml } from "./ebayDescriptionGenerator";
import { getTenantSettings } from "@/lib/api/tenantSettings";
import { Eye } from "lucide-react";

interface Props {
  form: EbayListingFormState;
  onChange: (patch: Partial<EbayListingFormState>) => void;
  vehicle: ProductVehicle | null | undefined;
  // Preview-only fallbacks, never saved.
  productDefaults: ListingProductDefaults;
}

// Preview of the template the server renders at push time.
export function EbayDescriptionSection({ form, onChange, vehicle, productDefaults }: Props) {
  const { data: tenantSettingsData } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: getTenantSettings,
  });
  const tenant = tenantSettingsData?.data;

  const customDescription = form.description_override.trim();
  const effectiveTitle = form.title_override.trim() || productDefaults.title;
  const fallbackImageUrl = productDefaults.photos[0]?.url;

  const html = useMemo(
    () =>
      customDescription ||
      generateListingHtml({ ...form, title_override: effectiveTitle }, vehicle, tenant?.company_name, tenant?.logo_url, {
        embedImages: true,
        fallbackImageUrl,
      }),
    [
      customDescription,
      effectiveTitle,
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
          {customDescription
            ? "Showing your custom description — it replaces the generated one on eBay."
            : "Generated from the product and listing details when pushed — always reflects the current product."}
        </p>
      </div>

      <OverrideField
        label="Custom description (HTML)"
        overridden={!!customDescription}
        onReset={() => onChange({ description_override: "" })}
        hint="Leave empty to use the generated description."
      >
        <Textarea
          value={form.description_override}
          onChange={(e) => onChange({ description_override: e.target.value })}
          placeholder="Auto-generated from product details (see preview)"
          rows={3}
        />
      </OverrideField>

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
