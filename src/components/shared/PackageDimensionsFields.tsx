import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import type { PackageFormState } from "@/types/product";

interface Props {
  value: PackageFormState;
  onChange: (pkg: PackageFormState) => void;
  error?: string;
  hint?: string;
}

// Packed length/width/height (cm) and weight (kg); product and eBay share it.
export function PackageDimensionsFields({ value, onChange, error, hint }: Props) {
  function patch(p: Partial<PackageFormState>) {
    onChange({ ...value, ...p });
  }

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FormField label="Length (cm)">
          <Input type="number" min="0" step="0.1" value={value.length} onChange={(e) => patch({ length: e.target.value })} />
        </FormField>
        <FormField label="Width (cm)">
          <Input type="number" min="0" step="0.1" value={value.width} onChange={(e) => patch({ width: e.target.value })} />
        </FormField>
        <FormField label="Height (cm)">
          <Input type="number" min="0" step="0.1" value={value.height} onChange={(e) => patch({ height: e.target.value })} />
        </FormField>
        <FormField label="Weight (kg)">
          <Input type="number" min="0" step="0.01" value={value.weight} onChange={(e) => patch({ weight: e.target.value })} />
        </FormField>
      </div>
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-fg/55">{hint}</p>
      ) : null}
    </div>
  );
}
