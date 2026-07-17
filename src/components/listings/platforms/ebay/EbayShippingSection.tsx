import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/Select";
import type { EbayListingFormState } from "@/types/marketplace";
import type { BusinessPolicy } from "@/types/ebay";
import type { EbayListingErrors } from "@/lib/validation/ebayListing";

interface Props {
  form: EbayListingFormState;
  onChange: (patch: Partial<EbayListingFormState>) => void;
  fulfillmentPolicies: BusinessPolicy[];
  policiesLoading?: boolean;
  errors?: EbayListingErrors;
  onClearError?: (field: keyof EbayListingErrors) => void;
}

export function EbayShippingSection({
  form,
  onChange,
  fulfillmentPolicies,
  policiesLoading = false,
  errors = {},
  onClearError,
}: Props) {
  const pkg = form.package;

  function patchPkg(patch: Partial<EbayListingFormState["package"]>) {
    onChange({ package: { ...pkg, ...patch } });
    onClearError?.("package");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Fulfillment Policy" required error={errors.fulfillment_policy_id}>
          <Select
            value={form.fulfillment_policy_id}
            onValueChange={(v) => { onChange({ fulfillment_policy_id: v }); onClearError?.("fulfillment_policy_id"); }}
            disabled={policiesLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  policiesLoading
                    ? "Loading…"
                    : fulfillmentPolicies.length === 0
                      ? "No policies found"
                      : "Select policy"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {fulfillmentPolicies.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!policiesLoading && fulfillmentPolicies.length === 0 && (
            <p className="mt-1 text-[11px] text-amber-500/80">
              No fulfillment policies found. Set one up in eBay Seller Hub.
            </p>
          )}
        </FormField>

        <FormField label="Item Location (Postcode)">
          <Input
            value={form.item_location_zip}
            onChange={(e) => onChange({ item_location_zip: e.target.value })}
            placeholder="e.g. 2000"
            maxLength={4}
          />
        </FormField>
      </div>

      <div>
        <p className={["mb-2 text-sm font-medium", errors.package ? "text-danger" : "text-fg"].join(" ")}>
          Package Dimensions &amp; Weight
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FormField label="Length (cm)">
            <Input
              type="number"
              min="0"
              value={pkg.length}
              onChange={(e) => patchPkg({ length: e.target.value })}
              placeholder="30"
            />
          </FormField>
          <FormField label="Width (cm)">
            <Input
              type="number"
              min="0"
              value={pkg.width}
              onChange={(e) => patchPkg({ width: e.target.value })}
              placeholder="20"
            />
          </FormField>
          <FormField label="Height (cm)">
            <Input
              type="number"
              min="0"
              value={pkg.height}
              onChange={(e) => patchPkg({ height: e.target.value })}
              placeholder="10"
            />
          </FormField>
          <FormField label="Weight (kg)">
            <Input
              type="number"
              min="0"
              step="0.1"
              value={pkg.weight}
              onChange={(e) => patchPkg({ weight: e.target.value })}
              placeholder="1.5"
            />
          </FormField>
        </div>
        {errors.package && (
          <p className="mt-1.5 text-xs text-danger">{errors.package}</p>
        )}
      </div>
    </div>
  );
}
