import type { ComponentType } from "react";
import { EbayCategoryInput } from "@/components/listings/platforms/ebay/EbayCategoryInput";
import { EbayItemSpecificsSection } from "@/components/listings/platforms/ebay/EbayItemSpecificsSection";
import { EbayVehicleFitmentSection } from "@/components/listings/platforms/ebay/EbayVehicleFitmentSection";
import { EbayPackageFields } from "@/components/listings/platforms/ebay/EbayPackageFields";
import type { ChannelFieldDescriptor } from "@/types/channel";
import type { EbayListingFormState } from "@/types/marketplace";
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
}

// Custom components for fields the generic renderer can't express ("<platform>.<key>").
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
  "ebay.item_specifics": ({ form, onChange, effectiveCategoryId }) => {
    const ebayForm = form as EbayListingFormState;
    return (
      <EbayItemSpecificsSection
        form={{ ...ebayForm, ebay_category_id: effectiveCategoryId ?? ebayForm.ebay_category_id }}
        // Don't write the mapped category back onto the listing.
        onChange={({ ebay_category_id: _ignored, ...patch }) => onChange(patch)}
      />
    );
  },
  "ebay.fitment": ({ form, onChange }) => (
    <EbayVehicleFitmentSection form={form as EbayListingFormState} onChange={onChange} />
  ),
  "ebay.package": ({ form, onChange, error }) => (
    <EbayPackageFields value={(form as EbayListingFormState).package} onChange={(pkg) => onChange({ package: pkg })} error={error} />
  ),
};
