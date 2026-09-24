import { Button } from "@/components/ui/Button";
import type { EbayListingFormState, FitmentRowFormState } from "@/types/marketplace";
import type { ProductVehicle } from "@/types/product";
import { Plus, Car } from "lucide-react";
import { FitmentRow } from "@/components/listings/platforms/ebay/FitmentRow";

interface Props {
  form: EbayListingFormState;
  onChange: (patch: Partial<EbayListingFormState>) => void;
  // Enables "Copy from product" when the product has a vehicle set.
  productVehicle?: ProductVehicle | null;
}

const EMPTY_ROW: FitmentRowFormState = {
  make: "",
  model: "",
  model_code: "",
  year_from: "",
  year_to: "",
};

export function EbayVehicleFitmentSection({ form, onChange, productVehicle }: Props) {
  const rows = form.fitment;
  const canCopy = !!(productVehicle?.make || productVehicle?.model);

  function copyFromProduct() {
    if (!productVehicle) return;
    onChange({
      fitment: [
        ...rows,
        {
          make: productVehicle.make ?? "",
          model: productVehicle.model ?? "",
          model_code: productVehicle.model_code ?? "",
          year_from: productVehicle.year_from != null ? String(productVehicle.year_from) : "",
          year_to: productVehicle.year_to != null ? String(productVehicle.year_to) : "",
        },
      ],
    });
  }

  function updateRow(index: number, patch: Partial<FitmentRowFormState>) {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange({ fitment: next });
  }

  function addRow() {
    onChange({ fitment: [...rows, { ...EMPTY_ROW }] });
  }

  function removeRow(index: number) {
    onChange({ fitment: rows.filter((_, i) => i !== index) });
  }

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
            {canCopy && (
              <Button type="button" variant="outline" size="sm" onClick={copyFromProduct}>
                Copy from product
              </Button>
            )}
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
                index={i}
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

      <p className="text-[11px] text-fg/40">
        Add all compatible vehicles. eBay uses this to display your listing in fitment search results.
      </p>
    </div>
  );
}
