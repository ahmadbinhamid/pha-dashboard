import { useQuery } from "@tanstack/react-query";
import { Combobox } from "@/components/ui/Combobox";
import { YearSelect } from "@/components/shared/YearSelect";
import {
  getVehicleMakes,
  getVehicleModels,
  getVehicleModelCodes,
  getVehicleYears,
} from "@/lib/api/vehicleModels";
import type { VehicleFormState } from "@/types/product";

interface ProductVehicleSectionProps {
  values: VehicleFormState;
  onChange: (patch: Partial<VehicleFormState>) => void;
  yearRangeError?: string;
}

export function ProductVehicleSection({ values, onChange, yearRangeError }: ProductVehicleSectionProps) {
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
        <YearSelect
          value={values.vehicle_year}
          onChange={(year_from) => onChange({ vehicle_year: year_from })}
        />
      </div>

      {/* Year To */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-fg/65">Year To</label>
        <YearSelect
          value={values.vehicle_year_to}
          onChange={(year_to) => onChange({ vehicle_year_to: year_to })}
          placeholder="Present"
          aria-invalid={!!yearRangeError}
        />
        {yearRangeError && <p className="text-xs text-danger">{yearRangeError}</p>}
      </div>
    </div>
  );
}
