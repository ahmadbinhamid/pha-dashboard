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
  // What a blank value resolves to server-side (e.g. the mapped category).
  fallback?: string | null;
  // The channel's effective category (listing value, else mapping) — eBay aspects key off it.
  effectiveCategoryId?: string | null;
}

// Fields a generic renderer can't express, keyed "<platform>.<fieldKey>". Everything else in
// an adapter's fieldSchema renders through ChannelFieldInput. eBay's live aspects API stays in
// EbayItemSpecificsSection rather than being squeezed into a generic schema.
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
        // Never let the aspects view write the mapped category back onto the listing.
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
