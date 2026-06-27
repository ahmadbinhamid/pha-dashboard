import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ProductImages } from "@/components/media/product-images";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EbayCategoryInput } from "@/components/listings/platforms/ebay/EbayCategoryInput";
import { EbayConditionSection } from "@/components/listings/platforms/ebay/EbayConditionSection";
import { EbayItemSpecificsSection } from "@/components/listings/platforms/ebay/EbayItemSpecificsSection";
import { EbayDescriptionSection } from "@/components/listings/platforms/ebay/EbayDescriptionSection";
import { EbayVehicleFitmentSection } from "@/components/listings/platforms/ebay/EbayVehicleFitmentSection";
import { EbayShippingSection } from "@/components/listings/platforms/ebay/EbayShippingSection";
import { EbaySyncStatusSection } from "@/components/listings/platforms/ebay/EbaySyncStatusSection";
import { getBusinessPolicies } from "@/lib/api/ebay";
import {
  validateEbayListing,
  hasEbayErrors,
  type EbayListingErrors,
} from "@/lib/validation/ebay-listing";
import type { EbayListing, EbayListingFormState } from "@/types/marketplace";
import type { BusinessPolicy } from "@/types/ebay";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Cloud } from "lucide-react";

// Auction durations — GTC is Fixed Price only
const LISTING_DURATIONS_FIXED = [
  { value: "GTC", label: "Good 'Til Cancelled" },
  { value: "DAYS_3", label: "3 Days" },
  { value: "DAYS_5", label: "5 Days" },
  { value: "DAYS_7", label: "7 Days" },
  { value: "DAYS_10", label: "10 Days" },
  { value: "DAYS_30", label: "30 Days" },
];

const LISTING_DURATIONS_AUCTION = [
  { value: "DAYS_1", label: "1 Day" },
  { value: "DAYS_3", label: "3 Days" },
  { value: "DAYS_5", label: "5 Days" },
  { value: "DAYS_7", label: "7 Days" },
  { value: "DAYS_10", label: "10 Days" },
];

interface SectionProps {
  number: number;
  title: string;
  children: React.ReactNode;
  hasError?: boolean;
}

function Section({ number, title, children, hasError }: SectionProps) {
  return (
    <Card className={hasError ? "ring-1 ring-danger/40" : ""}>
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <span
              className={[
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                hasError ? "bg-danger text-danger-fg" : "bg-accent text-accent-fg",
              ].join(" ")}
            >
              {number}
            </span>
            <span className="text-sm font-semibold uppercase tracking-wide">{title}</span>
            {hasError && <AlertCircle className="ml-auto h-4 w-4 text-danger" />}
          </div>
        }
      />
      <CardContent>{children}</CardContent>
    </Card>
  );
}

interface ListingFormProps {
  form: EbayListingFormState;
  onChange: (patch: Partial<EbayListingFormState>) => void;
  listing?: EbayListing | null;
  onSaveDraft: () => void;
  onPush: () => void;
  saving: boolean;
  pushing: boolean;
  isEdit?: boolean;
  externalErrors?: EbayListingErrors;
}

export function ListingForm({
  form,
  onChange,
  listing,
  onSaveDraft,
  onPush,
  saving,
  pushing,
  isEdit = false,
  externalErrors,
}: ListingFormProps) {
  const [errors, setErrors] = useState<EbayListingErrors>({});
  const [validated, setValidated] = useState(false);

  // Merge server 422 errors into local error state
  useEffect(() => {
    if (externalErrors && Object.keys(externalErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...externalErrors }));
      setValidated(true);
      setTimeout(() => {
        document.querySelector("[data-ebay-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  }, [externalErrors]);

  const titleLen = (form.title_override || "").length;
  const photoImages = form.photo_overrides || [];

  const { data: policiesData, isLoading: policiesLoading } = useQuery({
    queryKey: ["ebay-business-policies"],
    queryFn: getBusinessPolicies,
    staleTime: 10 * 60 * 1000,
  });

  const fulfillmentPolicies: BusinessPolicy[] = policiesData?.data?.fulfillment ?? [];
  const paymentPolicies: BusinessPolicy[] = policiesData?.data?.payment ?? [];
  const returnPolicies: BusinessPolicy[] = policiesData?.data?.return ?? [];

  const listingDurations =
    form.format === "AUCTION" ? LISTING_DURATIONS_AUCTION : LISTING_DURATIONS_FIXED;

  // Clear a single field's error when the user edits it
  function clearError(field: keyof EbayListingErrors) {
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  }

  function handlePush() {
    const errs = validateEbayListing(form);
    setValidated(true);
    if (hasEbayErrors(errs)) {
      setErrors(errs);
      // Scroll to first error
      setTimeout(() => {
        document.querySelector("[data-ebay-error]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }
    setErrors({});
    onPush();
  }

  const errorCount = Object.keys(errors).length;

  // Section-level error indicators
  const sec1Error = !!(errors.title_override || errors.ebay_category_id);
  const sec2Error = !!errors.photo_overrides;
  const sec4Error = !!errors.item_specifics;
  const sec6Error = !!(errors.price_override || errors.quantity_available || errors.listing_duration || errors.min_best_offer || errors.accept_best_offer);
  const sec7Error = !!(errors.fulfillment_policy_id || errors.package);
  const sec8Error = !!errors.return_policy_id;
  const sec9Error = !!errors.payment_policy_id;

  return (
    <div className="space-y-4">
      {/* Validation error summary */}
      {validated && errorCount > 0 && (
        <div
          className="flex items-start gap-3 rounded-md border border-danger/30 bg-danger/8 px-4 py-3"
          data-ebay-error
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <div className="text-sm text-danger">
            <span className="font-semibold">{errorCount} issue{errorCount !== 1 ? "s" : ""} must be fixed before pushing to eBay.</span>
            <span className="ml-1 text-danger/80">Sections with errors are highlighted in red.</span>
          </div>
        </div>
      )}

      {/* 1 — Title & Category */}
      <Section number={1} title="Listing Title & Category" hasError={sec1Error}>
        <div className="space-y-4">
          <FormField label="Listing Title" required error={errors.title_override}>
            <Input
              value={form.title_override}
              onChange={(e) => {
                onChange({ title_override: e.target.value });
                clearError("title_override");
              }}
              placeholder="e.g. OEM Front Brake Pad Set for 2018-2022 Honda Accord"
              maxLength={80}
            />
            <p className={["mt-1 text-xs", titleLen > 70 ? "text-warn" : "text-fg/50"].join(" ")}>
              {titleLen}/80 characters (eBay max 80)
            </p>
          </FormField>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <EbayCategoryInput
              label="eBay Category"
              required
              value={form.ebay_category_id}
              onChange={(id) => { onChange({ ebay_category_id: id }); clearError("ebay_category_id"); }}
              error={errors.ebay_category_id}
            />

            <EbayCategoryInput
              label="Store Category"
              value={form.store_category_id}
              onChange={(id) => onChange({ store_category_id: id })}
            />
          </div>

          <FormField label="Store SKU / Internal ID">
            <Input
              value={form.store_sku}
              onChange={(e) => onChange({ store_sku: e.target.value })}
              placeholder="e.g. AUTO-BP-12345"
            />
          </FormField>
        </div>
      </Section>

      {/* 2 — Photos */}
      <Section number={2} title="Photos" hasError={sec2Error}>
        <ProductImages
          images={photoImages}
          onChange={(imgs) => { onChange({ photo_overrides: imgs }); clearError("photo_overrides"); }}
        />
        {errors.photo_overrides && (
          <p className="mt-2 text-xs text-danger" data-ebay-error>{errors.photo_overrides}</p>
        )}
        <p className="mt-2 text-xs text-fg/50">
          Up to 24 images · JPEG, PNG · First photo is the main listing photo
        </p>
      </Section>

      {/* 3 — Item Condition */}
      <Section number={3} title="Item Condition">
        <EbayConditionSection form={form} onChange={onChange} />
      </Section>

      {/* 4 — Item Specifics */}
      <Section number={4} title="Item Specifics (eBay Required & Optional)" hasError={sec4Error}>
        <EbayItemSpecificsSection form={form} onChange={onChange} />
        {errors.item_specifics && (
          <p className="mt-2 text-xs text-danger" data-ebay-error>{errors.item_specifics}</p>
        )}
      </Section>

      {/* 5 — Vehicle Fitment */}
      <Section number={5} title="Vehicle Fitment">
        <EbayVehicleFitmentSection form={form} onChange={onChange} />
      </Section>

      {/* 6 — Item Description */}
      <Section number={6} title="Item Description">
        <div className="space-y-4">
          <FormField
            label="Custom Description Override"
            hint="Optional — leave blank to use the auto-generated description below."
          >
            <Textarea
              value={form.description_override ?? ""}
              onChange={(e) => onChange({ description_override: e.target.value })}
              placeholder="Paste or write a fully custom HTML or plain-text description. Overrides the auto-generated preview."
              rows={6}
            />
          </FormField>
          <EbayDescriptionSection form={form} />
        </div>
      </Section>

      {/* 7 — Pricing & Format */}
      <Section number={7} title="Pricing & Format" hasError={sec6Error}>
        <div className="space-y-4">
          <FormField label="Format">
            <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-md border border-border">
              {(["FIXED_PRICE", "AUCTION"] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => {
                    onChange({
                      format: fmt,
                      // Auto-fix duration when switching to auction if GTC is selected
                      listing_duration: fmt === "AUCTION" && form.listing_duration === "GTC"
                        ? "DAYS_7"
                        : form.listing_duration,
                    });
                    clearError("listing_duration");
                  }}
                  className={[
                    "px-4 py-2 text-sm transition-colors",
                    form.format === fmt
                      ? "bg-accent text-accent-fg font-medium"
                      : "bg-card text-fg hover:bg-bg-2",
                    "border-r border-border last:border-r-0",
                  ].join(" ")}
                >
                  {fmt === "FIXED_PRICE" ? "Buy It Now" : "Auction"}
                </button>
              ))}
            </div>
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label={form.format === "AUCTION" ? "Starting Bid (AUD)" : "Buy It Now Price (AUD)"}
              required
              error={errors.price_override}
            >
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg/50">A$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="pl-7"
                  value={form.price_override}
                  onChange={(e) => { onChange({ price_override: e.target.value }); clearError("price_override"); }}
                  placeholder="0.00"
                />
              </div>
            </FormField>

            <FormField label="Quantity Available" error={errors.quantity_available}>
              <Input
                type="number"
                min="1"
                value={form.quantity_available}
                onChange={(e) => { onChange({ quantity_available: e.target.value }); clearError("quantity_available"); }}
                placeholder="Leave blank to derive from inventory"
              />
            </FormField>
          </div>

          <FormField label="Listing Duration" error={errors.listing_duration}>
            <Select
              value={form.listing_duration}
              onValueChange={(v) => { onChange({ listing_duration: v }); clearError("listing_duration"); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                {listingDurations.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.accept_best_offer}
                onCheckedChange={(v) => { onChange({ accept_best_offer: v }); clearError("accept_best_offer"); }}
              />
              <span className="text-sm text-fg">Accept Best Offers</span>
            </div>
            {errors.accept_best_offer && (
              <p className="ml-10 text-xs text-danger" data-ebay-error>{errors.accept_best_offer}</p>
            )}
          </div>

          {form.accept_best_offer && (
            <FormField label="Minimum Best Offer Amount (AUD)" error={errors.min_best_offer}>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg/50">A$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="pl-7"
                  value={form.min_best_offer}
                  onChange={(e) => { onChange({ min_best_offer: e.target.value }); clearError("min_best_offer"); }}
                  placeholder="0.00"
                />
              </div>
            </FormField>
          )}
        </div>
      </Section>

      {/* 8 — Shipping */}
      <Section number={8} title="Shipping" hasError={sec7Error}>
        <EbayShippingSection
          form={form}
          onChange={onChange}
          fulfillmentPolicies={fulfillmentPolicies}
          policiesLoading={policiesLoading}
          errors={errors}
          onClearError={clearError}
        />
      </Section>

      {/* 9 — Return Policy */}
      <Section number={9} title="Return Policy" hasError={sec8Error}>
        <FormField label="Return Policy" required error={errors.return_policy_id}>
          <Select
            value={form.return_policy_id}
            onValueChange={(v) => { onChange({ return_policy_id: v }); clearError("return_policy_id"); }}
            disabled={policiesLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  policiesLoading
                    ? "Loading…"
                    : returnPolicies.length === 0
                      ? "No policies found"
                      : "Select policy"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {returnPolicies.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!policiesLoading && returnPolicies.length === 0 && (
            <p className="mt-1 text-[11px] text-amber-500/80">
              No return policies found. Set one up in eBay Seller Hub.
            </p>
          )}
        </FormField>
      </Section>

      {/* 10 — Payment */}
      <Section number={10} title="Payment" hasError={sec9Error}>
        <div className="space-y-4">
          <FormField label="Payment Policy" required error={errors.payment_policy_id}>
            <Select
              value={form.payment_policy_id}
              onValueChange={(v) => { onChange({ payment_policy_id: v }); clearError("payment_policy_id"); }}
              disabled={policiesLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    policiesLoading
                      ? "Loading…"
                      : paymentPolicies.length === 0
                        ? "No policies found"
                        : "Select policy"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {paymentPolicies.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!policiesLoading && paymentPolicies.length === 0 && (
              <p className="mt-1 text-[11px] text-amber-500/80">
                No payment policies found. Set one up in eBay Seller Hub.
              </p>
            )}
          </FormField>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.require_immediate_payment}
                onCheckedChange={(v) => onChange({ require_immediate_payment: v })}
              />
              <span className="text-sm text-fg">Require Immediate Payment (Buy It Now only)</span>
            </div>
            <p className="ml-10 text-[11px] text-fg/45">
              Enforced via the payment policy — enable "Require immediate payment" in eBay Seller Hub to apply it.
            </p>
          </div>
        </div>
      </Section>

      {/* 11 — eBay Sync Status (edit mode only) */}
      {isEdit && (
        <Section number={11} title="eBay Sync Status">
          <EbaySyncStatusSection listing={listing} />
        </Section>
      )}

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 rounded-md border border-border bg-card px-5 py-3 shadow-md">
        {validated && errorCount > 0 && (
          <span className="mr-auto text-xs text-danger">
            {errorCount} issue{errorCount !== 1 ? "s" : ""} — fix errors before pushing
          </span>
        )}
        <Button variant="outline" type="button" onClick={onSaveDraft} disabled={saving || pushing}>
          {saving ? "Saving…" : "Save Draft"}
        </Button>
        <Button variant="outline" type="button" disabled>
          Preview Listing
        </Button>
        <Button type="button" onClick={handlePush} disabled={saving || pushing} className="gap-2">
          <Cloud className="h-4 w-4" />
          {pushing ? "Pushing…" : "Save & Push to eBay"}
        </Button>
      </div>
    </div>
  );
}
