import { useQuery } from "@tanstack/react-query";
import { Combobox } from "@/components/ui/Combobox";
import { Input } from "@/components/ui/Input";
import {
  getVehicleMakes,
  getVehicleModels,
  getVehicleModelCodes,
  getVehicleYears,
} from "@/lib/api/vehicleModels";
import type { FitmentRowFormState } from "@/types/marketplace";
import { Trash2 } from "lucide-react";

export function FitmentRow({
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
