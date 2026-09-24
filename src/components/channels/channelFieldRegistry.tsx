import type { ComponentType } from "react";
import { EbayCategoryInput } from "@/components/listings/platforms/ebay/EbayCategoryInput";
import { EbayItemSpecificsSection } from "@/components/listings/platforms/ebay/EbayItemSpecificsSection";
import { EbayVehicleFitmentSection } from "@/components/listings/platforms/ebay/EbayVehicleFitmentSection";
import { EbayPackageFields } from "@/components/listings/platforms/ebay/EbayPackageFields";
import { ChannelFieldInput } from "@/components/channels/ChannelFieldInput";
import type { ChannelFieldDescriptor } from "@/types/channel";
import type { EbayListingFormState } from "@/types/marketplace";
import type { Product } from "@/types/product";
import type { ChannelFormState } from "@/lib/marketplace/channelForms";

export interface ChannelCustomFieldProps {
  descriptor: ChannelFieldDescriptor;
  form: ChannelFormState;
  onChange: (patch: Partial<ChannelFormState>) => void;
  error?: string;
  // Server-side fallback for a blank value (e.g. mapped category).
  fallback?: string | null;
  // Effective category; eBay aspects depend on it.
  effectiveCategoryId?: string | null;
  product: Product;
}

// Custom renderers the generic one can't express, keyed "<platform>.<key>".
export const CHANNEL_FIELD_COMPONENTS: Record<string, ComponentType<ChannelCustomFieldProps>> = {
  "ebay.ebay_category_id": ({ descriptor, form, onChange, error, fallback }) => (
    <EbayCategoryInput
      label={descriptor.label}
      required={descriptor.required && !fallback}
      value={(form as EbayListingFormState).ebay_category_id}
      onChange={(id) => onChange({ ebay_category_id: id })}
      error={error}
    />
  ),
  "ebay.item_specifics": ({ form, onChange, effectiveCategoryId, product }) => {
    const ebayForm = form as EbayListingFormState;
    return (
      <EbayItemSpecificsSection
        form={{ ...ebayForm, ebay_category_id: effectiveCategoryId ?? ebayForm.ebay_category_id }}
        // Don't write the mapped category back onto the listing.
        onChange={({ ebay_category_id: _ignored, ...patch }) => onChange(patch)}
        productMpn={product.mpn}
      />
    );
  },
  "ebay.fitment": ({ form, onChange, product }) => (
    <EbayVehicleFitmentSection form={form as EbayListingFormState} onChange={onChange} productVehicle={product.vehicle} />
  ),
  "ebay.package": ({ form, onChange, error }) => (
    <EbayPackageFields value={(form as EbayListingFormState).package} onChange={(pkg) => onChange({ package: pkg })} error={error} />
  ),
  // Only meaningful when best offers are accepted.
  "ebay.min_best_offer": ({ descriptor, form, onChange, error }) => {
    const ebayForm = form as EbayListingFormState;
    if (!ebayForm.accept_best_offer) return null;
    return (
      <ChannelFieldInput
        descriptor={descriptor}
        value={ebayForm.min_best_offer}
        onChange={(value) => onChange({ min_best_offer: String(value) })}
        error={error}
      />
    );
  },
};
