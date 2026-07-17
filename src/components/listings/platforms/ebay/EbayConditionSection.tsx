import { FormField } from "@/components/ui/FormField";
import { Textarea } from "@/components/ui/Textarea";
import { NativeSelect } from "@/components/ui/Select";
import type { EbayListingFormState } from "@/types/marketplace";
import { CONDITIONS, AUTHENTICITY_OPTIONS, WARRANTY_OPTIONS } from "@/config/productOptions";

interface Props {
  form: EbayListingFormState;
  onChange: (patch: Partial<EbayListingFormState>) => void;
}

export function EbayConditionSection({ form, onChange }: Props) {
  function patchSpecs(patch: Partial<EbayListingFormState["item_specifics"]>) {
    onChange({ item_specifics: { ...form.item_specifics, ...patch } });
  }

  return (
    <div className="space-y-4">
      <FormField label="Item Condition" required>
        <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-md border border-border">
          {CONDITIONS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => onChange({ condition: c.value })}
              className={[
                "px-4 py-2 text-sm transition-colors",
                form.condition === c.value
                  ? "bg-accent text-accent-fg font-medium"
                  : "bg-card text-fg hover:bg-bg-2",
                "border-r border-border last:border-r-0",
              ].join(" ")}
            >
              {c.label}
            </button>
          ))}
        </div>
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Authenticity">
          <NativeSelect
            value={form.item_specifics.authenticity}
            onChange={(e) => patchSpecs({ authenticity: e.target.value })}
          >
            <option value="">Select authenticity…</option>
            {AUTHENTICITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </NativeSelect>
        </FormField>

        <FormField label="Warranty">
          <NativeSelect
            value={form.item_specifics.warranty}
            onChange={(e) => patchSpecs({ warranty: e.target.value })}
          >
            <option value="">Select warranty…</option>
            {WARRANTY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </NativeSelect>
        </FormField>
      </div>

      <FormField label="Condition Notes / Description to Buyer">
        <Textarea
          value={form.condition_notes}
          onChange={(e) => onChange({ condition_notes: e.target.value })}
          placeholder="Include specific details about cosmetic wear, missing components, or test results…"
          rows={3}
        />
      </FormField>
    </div>
  );
}
