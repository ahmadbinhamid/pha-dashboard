import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { MAKES, getModels, getModelCodes, getYears } from "@/lib/data/vehicle-models";

export interface VehicleFormState {
  vehicle_make: string;
  vehicle_model: string;
  vehicle_model_code: string;
  vehicle_year: string;
  vehicle_year_to: string;
}

interface ProductVehicleSectionProps {
  values: VehicleFormState;
  onChange: (patch: Partial<VehicleFormState>) => void;
}

export function ProductVehicleSection({ values, onChange }: ProductVehicleSectionProps) {
  const models = values.vehicle_make ? getModels(values.vehicle_make) : [];
  const modelCodes =
    values.vehicle_make && values.vehicle_model
      ? getModelCodes(values.vehicle_make, values.vehicle_model)
      : [];

  function handleMakeChange(make: string) {
    onChange({ vehicle_make: make, vehicle_model: "", vehicle_model_code: "", vehicle_year: "", vehicle_year_to: "" });
  }

  function handleModelChange(model: string) {
    onChange({ vehicle_model: model, vehicle_model_code: "", vehicle_year: "", vehicle_year_to: "" });
  }

  function handleModelCodeChange(model_code: string) {
    const years = getYears(values.vehicle_make, values.vehicle_model, model_code);
    onChange({
      vehicle_model_code: model_code,
      vehicle_year: years ? String(years.year_from) : "",
      vehicle_year_to: years?.year_to != null ? String(years.year_to) : "",
    });
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Make */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-fg/65">Make</label>
        <Combobox
          options={MAKES}
          value={values.vehicle_make}
          onChange={handleMakeChange}
          placeholder="Select make…"
          searchPlaceholder="Search makes…"
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
          searchPlaceholder="Search models…"
          disabled={!values.vehicle_make}
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
          searchPlaceholder="Search codes…"
          disabled={!values.vehicle_model}
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
