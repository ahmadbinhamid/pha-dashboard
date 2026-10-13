import { useQueries, useQuery } from "@tanstack/react-query";
import { FormField } from "@/components/ui/FormField";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { VEHICLE_YEAR_OPTIONS } from "@/config/vehicleYears";
import { getVehicleMakes, getVehicleModelCodes, getVehicleModels } from "@/lib/api/vehicleModels";
import { withVehicleList } from "@/lib/products/vehicleSearch";
import type { ProductVehicleSearch } from "@/types/product";

interface ProductVehicleSearchPanelProps {
  value: ProductVehicleSearch;
  onChange: (value: ProductVehicleSearch) => void;
}

const YEAR_OPTIONS = VEHICLE_YEAR_OPTIONS.map((year) => ({ value: year, label: year }));

const toOptions = (lists: (string[] | undefined)[]) =>
  [...new Set(lists.flatMap((list) => list ?? []))].sort().map((v) => ({ value: v, label: v }));

// Multi-select make/model/code/year; options come from the vehicle catalog.
export function ProductVehicleSearchPanel({ value, onChange }: ProductVehicleSearchPanelProps) {
  const { data: makesRes } = useQuery({ queryKey: ["vehicle-makes"], queryFn: getVehicleMakes, staleTime: Infinity });
  // Same query keys as FitmentRow, so the product form's cache is reused.
  const modelQueries = useQueries({
    queries: value.makes.map((make) => ({
      queryKey: ["vehicle-models", make],
      queryFn: () => getVehicleModels(make),
      staleTime: Infinity,
    })),
  });
  const pairs = value.makes.flatMap((make) => value.models.map((model) => [make, model] as const));
  const codeQueries = useQueries({
    queries: pairs.map(([make, model]) => ({
      queryKey: ["vehicle-model-codes", make, model],
      queryFn: () => getVehicleModelCodes(make, model),
      staleTime: Infinity,
    })),
  });

  const makeOptions = toOptions([makesRes?.data]);
  const modelOptions = toOptions(modelQueries.map((q) => q.data?.data));
  const codeOptions = toOptions(codeQueries.map((q) => q.data?.data));

  const set = (key: keyof ProductVehicleSearch) => (values: string[]) => onChange(withVehicleList(value, key, values));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Make">
          <MultiSelect options={makeOptions} value={value.makes} onChange={set("makes")} placeholder="Any make" searchPlaceholder="Search makes…" />
        </FormField>
        <FormField label="Model">
          <MultiSelect
            options={modelOptions}
            value={value.models}
            onChange={set("models")}
            placeholder={value.makes.length ? "Any model" : "Select a make first"}
            searchPlaceholder="Search models…"
            disabled={!value.makes.length}
          />
        </FormField>
        <FormField label="Model code">
          <MultiSelect
            options={codeOptions}
            value={value.modelCodes}
            onChange={set("modelCodes")}
            placeholder={value.models.length ? "Any code" : "Select a model first"}
            searchPlaceholder="Search codes…"
            disabled={!value.models.length}
          />
        </FormField>
        <FormField label="Year">
          <MultiSelect
            options={YEAR_OPTIONS}
            value={value.years}
            onChange={set("years")}
            placeholder="Any year"
            searchPlaceholder="Search years…"
          />
        </FormField>
    </div>
  );
}
