import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  getVehicleMakes,
  getVehicleModels,
  getVehicleModelCodes,
  getVehicleYears,
} from "@/lib/api/vehicle-models";
import type { EbayListingFormState, FitmentRowFormState } from "@/types/marketplace";
import { Plus, Trash2, Car } from "lucide-react";

interface Props {
  form: EbayListingFormState;
  onChange: (patch: Partial<EbayListingFormState>) => void;
}

const EMPTY_ROW: FitmentRowFormState = {
  make: "",
  model: "",
  model_code: "",
  year_from: "",
  year_to: "",
};

function FitmentRow({
  row,
  index,
  onUpdate,
  onRemove,
}: {
  row: FitmentRowFormState;
  index: number;
  onUpdate: (patch: Partial<FitmentRowFormState>) => void;
  onRemove: () => void;
}) {
  const { data: makesRes } = useQuery({
    queryKey: ["vehicle-makes"],
    queryFn: getVehicleMakes,
    staleTime: Infinity,
  });
  const { data: modelsRes } = useQuery({
    queryKey: ["vehicle-models", row.make],
    queryFn: () => getVehicleModels(row.make),
    enabled: !!row.make,
    staleTime: Infinity,
  });
  const { data: modelCodesRes } = useQuery({
    queryKey: ["vehicle-model-codes", row.make, row.model],
    queryFn: () => getVehicleModelCodes(row.make, row.model),
    enabled: !!row.make && !!row.model,
    staleTime: Infinity,
  });

  const makes = makesRes?.data ?? [];
  const models = row.make ? (modelsRes?.data ?? []) : [];
  const modelCodes = row.make && row.model ? (modelCodesRes?.data ?? []) : [];

  function handleMakeChange(make: string) {
    // Reset everything downstream when make changes
    onUpdate({ make, model: "", model_code: "", year_from: "", year_to: "" });
  }

  function handleModelChange(model: string) {
    // Reset model_code and years when model changes
    onUpdate({ model, model_code: "", year_from: "", year_to: "" });
  }

  async function handleModelCodeChange(model_code: string) {
    try {
      const res = await getVehicleYears(row.make, row.model, model_code);
      onUpdate({
        model_code,
        year_from: String(res.data.year_from),
        year_to: res.data.year_to != null ? String(res.data.year_to) : "",
      });
    } catch {
      onUpdate({ model_code, year_from: "", year_to: "" });
    }
  }

  return (
    <div className="rounded-xs border border-border bg-bg-2/30 p-3 space-y-3">
      {/* Row index label */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg/40">
          Vehicle {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-7 w-7 items-center justify-center rounded-xs border border-border text-fg/40 transition-colors hover:border-danger/50 hover:bg-danger/5 hover:text-danger"
          title="Remove vehicle"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Make + Model */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-fg/40">Make</span>
          <Combobox
            options={makes}
            value={row.make}
            onChange={handleMakeChange}
            placeholder="Select make…"
            searchPlaceholder="Search or add a make…"
            allowCustom
          />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-fg/40">Model</span>
          <Combobox
            options={models}
            value={row.model}
            onChange={handleModelChange}
            placeholder={row.make ? "Select model…" : "Select make first"}
            searchPlaceholder="Search or add a model…"
            disabled={!row.make}
            allowCustom
          />
        </div>
      </div>

      {/* Model Code + Years */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-fg/40">Model Code</span>
          <Combobox
            options={modelCodes}
            value={row.model_code}
            onChange={handleModelCodeChange}
            placeholder={row.model ? "Select code…" : "Select model first"}
            searchPlaceholder="Search or add a code…"
            disabled={!row.model}
            allowCustom
          />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-fg/40">Year From</span>
          <Input
            type="number"
            min="1900"
            max="2100"
            value={row.year_from}
            onChange={(e) => onUpdate({ year_from: e.target.value })}
            placeholder="e.g. 2015"
          />
        </div>
        <div className="space-y-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-fg/40">Year To</span>
          <Input
            type="number"
            min="1900"
            max="2100"
            value={row.year_to}
            onChange={(e) => onUpdate({ year_to: e.target.value })}
            placeholder="Present"
          />
        </div>
      </div>
    </div>
  );
}

export function EbayVehicleFitmentSection({ form, onChange }: Props) {
  const rows = form.fitment;

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
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Vehicle
          </Button>
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
