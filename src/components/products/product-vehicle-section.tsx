import { useQuery } from "@tanstack/react-query";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  getVehicleMakes,
  getVehicleModels,
  getVehicleModelCodes,
  getVehicleYears,
} from "@/lib/api/vehicle-models";
import type { VehicleFormState } from "@/types/product";

interface ProductVehicleSectionProps {
  values: VehicleFormState;
  onChange: (patch: Partial<VehicleFormState>) => void;
}

export function ProductVehicleSection({ values, onChange }: ProductVehicleSectionProps) {
  const { data: makesRes } = useQuery({
    queryKey: ["vehicle-makes"],
    queryFn: getVehicleMakes,
    staleTime: Infinity,
  });
  const { data: modelsRes } = useQuery({
    queryKey: ["vehicle-models", values.vehicle_make],
    queryFn: () => getVehicleModels(values.vehicle_make),
    enabled: !!values.vehicle_make,
    staleTime: Infinity,
  });
  const { data: modelCodesRes } = useQuery({
    queryKey: ["vehicle-model-codes", values.vehicle_make, values.vehicle_model],
    queryFn: () => getVehicleModelCodes(values.vehicle_make, values.vehicle_model),
    enabled: !!values.vehicle_make && !!values.vehicle_model,
    staleTime: Infinity,
  });

  const makes = makesRes?.data ?? [];
  const models = values.vehicle_make ? (modelsRes?.data ?? []) : [];
  const modelCodes =
    values.vehicle_make && values.vehicle_model ? (modelCodesRes?.data ?? []) : [];

  function handleMakeChange(make: string) {
    onChange({ vehicle_make: make, vehicle_model: "", vehicle_model_code: "", vehicle_year: "", vehicle_year_to: "" });
  }

  function handleModelChange(model: string) {
    onChange({ vehicle_model: model, vehicle_model_code: "", vehicle_year: "", vehicle_year_to: "" });
  }

  async function handleModelCodeChange(model_code: string) {
    try {
      const res = await getVehicleYears(values.vehicle_make, values.vehicle_model, model_code);
      onChange({
        vehicle_model_code: model_code,
        vehicle_year: String(res.data.year_from),
        vehicle_year_to: res.data.year_to != null ? String(res.data.year_to) : "",
      });
    } catch {
      onChange({ vehicle_model_code: model_code, vehicle_year: "", vehicle_year_to: "" });
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Make */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-fg/65">Make</label>
        <Combobox
          options={makes}
          value={values.vehicle_make}
          onChange={handleMakeChange}
          placeholder="Select make…"
          searchPlaceholder="Search or add a make…"
          allowCustom
        />
      </div>

      {/* Model */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-fg/65">Model</label>
        <Combobox
          options={models}
          value={values.vehicle_model}
          onChange={handleModelChange}
          placeholder="Select model…"
          searchPlaceholder="Search or add a model…"
          disabled={!values.vehicle_make}
          allowCustom
        />
      </div>

      {/* Model Code — full width */}
      <div className="col-span-2 flex flex-col gap-1.5">
        <label className="text-xs font-medium text-fg/65">Model Code</label>
        <Combobox
          options={modelCodes}
          value={values.vehicle_model_code}
          onChange={handleModelCodeChange}
          placeholder="Select code…"
          searchPlaceholder="Search or add a code…"
          disabled={!values.vehicle_model}
          allowCustom
        />
      </div>

      {/* Year From */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-fg/65">Year From</label>
        <Input
          type="number"
          min="1900"
          max="2100"
          value={values.vehicle_year}
          onChange={(e) => onChange({ vehicle_year: e.target.value })}
          placeholder="e.g. 2015"
        />
      </div>

      {/* Year To */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-fg/65">Year To</label>
        <Input
          type="number"
          min="1900"
          max="2100"
          value={values.vehicle_year_to}
          onChange={(e) => onChange({ vehicle_year_to: e.target.value })}
          placeholder="Present"
        />
      </div>
    </div>
  );
}
