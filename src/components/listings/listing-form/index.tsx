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
import { EbayVehicleFitmentSection } from "@/components/listings/platforms/ebay/EbayVehicleFitmentSection";
import { EbayDescriptionSection } from "@/components/listings/platforms/ebay/EbayDescriptionSection";
import { EbayShippingSection } from "@/components/listings/platforms/ebay/EbayShippingSection";
import { EbaySyncStatusSection } from "@/components/listings/platforms/ebay/EbaySyncStatusSection";
import { getBusinessPolicies } from "@/lib/api/ebay";
import type { EbayListing, EbayListingFormState } from "@/types/marketplace";
import type { BusinessPolicy } from "@/types/ebay";
import type { Attachment } from "@/types/product";
import { Cloud } from "lucide-react";

// Converts stored attachment IDs back to Attachment-shaped objects for ProductImages
function idsToAttachments(ids: string[]): Attachment[] {
  return ids.map((id) => ({ _id: id, id, uid: id, file_name: "", original_name: "", mime_type: "image/jpeg", size: 0, url: "", type: "image" as const }));
}

const LISTING_DURATIONS = [
  { value: "GTC", label: "Good 'Til Cancelled" },
  { value: "DAYS_3", label: "3 Days" },
  { value: "DAYS_5", label: "5 Days" },
  { value: "DAYS_7", label: "7 Days" },
  { value: "DAYS_10", label: "10 Days" },
  { value: "DAYS_30", label: "30 Days" },
];

interface SectionProps {
  number: number;
  title: string;
  children: React.ReactNode;
}

function Section({ number, title, children }: SectionProps) {
  return (
    <Card>
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {number}
            </span>
            <span className="text-sm font-semibold uppercase tracking-wide">{title}</span>
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
}: ListingFormProps) {
  const titleLen = (form.title_override || "").length;
  const photoImages = idsToAttachments(form.photo_overrides || []);

  const { data: policiesData, isLoading: policiesLoading } = useQuery({
    queryKey: ["ebay-business-policies"],
    queryFn: getBusinessPolicies,
    staleTime: 10 * 60 * 1000,
  });

  const fulfillmentPolicies: BusinessPolicy[] = policiesData?.data?.fulfillment ?? [];
  const paymentPolicies: BusinessPolicy[] = policiesData?.data?.payment ?? [];
  const returnPolicies: BusinessPolicy[] = policiesData?.data?.return ?? [];

  return (
    <div className="space-y-4">
      {/* 1 — Title & Category */}
      <Section number={1} title="Listing Title & Category">
        <div className="space-y-4">
          <FormField label="Listing Title" required>
            <Input
              value={form.title_override}
              onChange={(e) => onChange({ title_override: e.target.value })}
              placeholder="e.g. OEM Front Brake Pad Set for 2018-2022 Honda Accord"
              maxLength={80}
            />
            <p className="mt-1 text-xs text-fg/50">{titleLen}/80 characters (eBay max 80)</p>
          </FormField>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <EbayCategoryInput
              label="eBay Category"
              required
              value={form.ebay_category_id}
              onChange={(id) => onChange({ ebay_category_id: id })}
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
      <Section number={2} title="Photos">
        <ProductImages
          images={photoImages}
          onChange={(imgs) => onChange({ photo_overrides: imgs.map((a) => a._id || a.id) })}
        />
        <p className="mt-2 text-xs text-fg/50">
          Up to 24 images · JPEG, PNG · First photo is the main listing photo
        </p>
      </Section>

      {/* 3 — Item Condition */}
      <Section number={3} title="Item Condition">
        <EbayConditionSection form={form} onChange={onChange} />
      </Section>

      {/* 4 — Item Specifics */}
      <Section number={4} title="Item Specifics (eBay Required & Optional)">
        <EbayItemSpecificsSection form={form} onChange={onChange} />
      </Section>

      {/* 5 — Vehicle Fitment */}
      <Section number={5} title="Vehicle Fitment">
        <EbayVehicleFitmentSection form={form} onChange={onChange} />
      </Section>

      {/* 6 — Item Description */}
      <Section number={6} title="Item Description">
        <EbayDescriptionSection form={form} />
      </Section>

      {/* 7 — Pricing & Format */}
      <Section number={7} title="Pricing & Format">
        <div className="space-y-4">
          <FormField label="Format">
            <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-md border border-border">
              {(["FIXED_PRICE", "AUCTION"] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => onChange({ format: fmt })}
                  className={[
                    "px-4 py-2 text-sm transition-colors",
                    form.format === fmt
                      ? "bg-primary text-white"
                      : "bg-card text-fg hover:bg-muted",
                    "border-r border-border last:border-r-0",
                  ].join(" ")}
                >
                  {fmt === "FIXED_PRICE" ? "Buy It Now" : "Auction"}
                </button>
              ))}
            </div>
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Buy It Now Price (AUD)" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg/50">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="pl-7"
                  value={form.price_override}
                  onChange={(e) => onChange({ price_override: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </FormField>

            <FormField label="Quantity Available">
              <Input
                type="number"
                min="1"
                value={form.quantity_available}
                onChange={(e) => onChange({ quantity_available: e.target.value })}
                placeholder="Leave blank to derive from inventory"
              />
            </FormField>
          </div>

          <FormField label="Listing Duration">
            <Select
              value={form.listing_duration}
              onValueChange={(v) => onChange({ listing_duration: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                {LISTING_DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <div className="flex items-center gap-2">
            <Switch
              checked={form.accept_best_offer}
              onCheckedChange={(v) => onChange({ accept_best_offer: v })}
            />
            <span className="text-sm text-fg">Accept Best Offers</span>
          </div>

          {form.accept_best_offer && (
            <FormField label="Minimum Best Offer Amount (AUD)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg/50">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="pl-7"
                  value={form.min_best_offer}
                  onChange={(e) => onChange({ min_best_offer: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </FormField>
          )}
        </div>
      </Section>

      {/* 8 — Shipping */}
      <Section number={8} title="Shipping">
        <EbayShippingSection
          form={form}
          onChange={onChange}
          fulfillmentPolicies={fulfillmentPolicies}
          policiesLoading={policiesLoading}
        />
      </Section>

      {/* 9 — Return Policy */}
      <Section number={9} title="Return Policy">
        <FormField label="Return Policy" required>
          <Select
            value={form.return_policy_id}
            onValueChange={(v) => onChange({ return_policy_id: v })}
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
      <Section number={10} title="Payment">
        <div className="space-y-4">
          <FormField label="Payment Policy" required>
            <Select
              value={form.payment_policy_id}
              onValueChange={(v) => onChange({ payment_policy_id: v })}
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

      {/* Sticky footer actions */}
      <div className="sticky bottom-0 z-10 flex justify-end gap-3 rounded-md border border-border bg-card px-5 py-3 shadow-md">
        <Button variant="outline" type="button" onClick={onSaveDraft} disabled={saving || pushing}>
          {saving ? "Saving…" : "Save Draft"}
        </Button>
        <Button variant="outline" type="button" disabled>
          Preview Listing
        </Button>
        <Button type="button" onClick={onPush} disabled={saving || pushing} className="gap-2">
          <Cloud className="h-4 w-4" />
          {pushing ? "Pushing…" : "Save & Push to eBay"}
        </Button>
      </div>
    </div>
  );
}
