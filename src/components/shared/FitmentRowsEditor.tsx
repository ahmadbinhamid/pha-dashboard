import type { ReactNode } from "react";
import { Car, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FitmentRow } from "@/components/shared/FitmentRow";
import { EMPTY_FITMENT_ROW } from "@/config/fitment";
import type { FitmentRowFormState } from "@/types/marketplace";

interface FitmentRowsEditorProps {
  rows: FitmentRowFormState[];
  onChange: (rows: FitmentRowFormState[]) => void;
  hint: string;
  // Extra buttons beside "Add Vehicle" while the list is empty.
  emptyActions?: ReactNode;
  rowLabel?: (index: number) => string;
}

export function FitmentRowsEditor({ rows, onChange, hint, emptyActions, rowLabel }: FitmentRowsEditorProps) {
  const updateRow = (index: number, patch: Partial<FitmentRowFormState>) =>
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const addRow = () => onChange([...rows, { ...EMPTY_FITMENT_ROW }]);
  const removeRow = (index: number) => onChange(rows.filter((_, i) => i !== index));

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xs border border-dashed border-border py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xs bg-bg-2">
            <Car className="h-5 w-5 text-fg/30" />
          </div>
          <div>
            <p className="text-sm font-medium text-fg">No vehicles added yet</p>
            <p className="mt-0.5 text-xs text-fg/45">
              Add make, model and year range to help buyers find compatible parts.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {emptyActions}
            <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Vehicle
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {rows.map((row, i) => (
              <FitmentRow
                key={i}
                row={row}
                label={rowLabel?.(i) ?? `Vehicle ${i + 1}`}
                onUpdate={(patch) => updateRow(i, patch)}
                onRemove={() => removeRow(i)}
              />
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1.5 text-xs">
            <Plus className="h-3 w-3" />
            Add Vehicle
          </Button>
        </>
      )}

      <p className="text-2xs text-fg/40">{hint}</p>
    </div>
  );
}
