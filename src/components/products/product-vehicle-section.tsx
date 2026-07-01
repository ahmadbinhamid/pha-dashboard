import { Combobox } from "@/components/ui/combobox";
import { MAKES, getModels, getModelCodes, getYears } from "@/lib/data/vehicle-models";

export interface VehicleFormState {
  vehicle_make: string;
  vehicle_model: string;
  vehicle_model_code: string;
  vehicle_year: string;
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
    onChange({ vehicle_make: make, vehicle_model: "", vehicle_model_code: "", vehicle_year: "" });
  }

  function handleModelChange(model: string) {
    onChange({ vehicle_model: model, vehicle_model_code: "", vehicle_year: "" });
  }

  function handleModelCodeChange(model_code: string) {
    const years = getYears(values.vehicle_make, values.vehicle_model, model_code);
    onChange({
      vehicle_model_code: model_code,
      vehicle_year: years ? String(years.year_from) : "",
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

      {/* Model Code */}
      <div className="flex flex-col gap-1.5">
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

      {/* Year Released — auto-populated from model code */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-fg/65">Year Released</label>
        <div
          className={
            "flex h-10 items-center rounded-xs border border-border bg-bg px-3 text-sm " +
            (values.vehicle_year ? "text-fg" : "text-fg/40")
          }
        >
          {values.vehicle_year || "Auto-filled on code selection"}
        </div>
      </div>
    </div>
  );
}
