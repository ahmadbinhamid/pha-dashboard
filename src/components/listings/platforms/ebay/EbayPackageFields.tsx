import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import type { EbayListingFormState } from "@/types/marketplace";

interface Props {
  value: EbayListingFormState["package"];
  onChange: (pkg: EbayListingFormState["package"]) => void;
  error?: string;
}

// Package dimensions + weight (sent to eBay as packageWeightAndSize).
export function EbayPackageFields({ value, onChange, error }: Props) {
  function patch(p: Partial<EbayListingFormState["package"]>) {
    onChange({ ...value, ...p });
  }

  return (
    <div>
      <p className={["mb-2 text-sm font-medium", error ? "text-danger" : "text-fg"].join(" ")}>
        Package Dimensions &amp; Weight
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FormField label="Length (cm)">
          <Input type="number" min="0" value={value.length} onChange={(e) => patch({ length: e.target.value })} placeholder="30" />
        </FormField>
        <FormField label="Width (cm)">
          <Input type="number" min="0" value={value.width} onChange={(e) => patch({ width: e.target.value })} placeholder="20" />
        </FormField>
        <FormField label="Height (cm)">
          <Input type="number" min="0" value={value.height} onChange={(e) => patch({ height: e.target.value })} placeholder="10" />
        </FormField>
        <FormField label="Weight (kg)">
          <Input type="number" min="0" step="0.1" value={value.weight} onChange={(e) => patch({ weight: e.target.value })} placeholder="1.5" />
        </FormField>
      </div>
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
