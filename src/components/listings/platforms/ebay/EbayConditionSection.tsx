import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import type { EbayListingFormState } from "@/types/marketplace";

const CONDITIONS = [
  { value: "NEW", label: "New" },
  { value: "USED", label: "Used" },
];

interface Props {
  form: EbayListingFormState;
  onChange: (patch: Partial<EbayListingFormState>) => void;
}

export function EbayConditionSection({ form, onChange }: Props) {
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
