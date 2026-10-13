import type { FitmentRowFormState } from "@/types/marketplace";
import type { ProductVehicleSearch } from "@/types/product";

export const EMPTY_FITMENT_ROW: FitmentRowFormState = { make: "", model: "", model_code: "", year_from: "", year_to: "" };

export const EMPTY_VEHICLE_SEARCH: ProductVehicleSearch = { makes: [], models: [], modelCodes: [], years: [] };

// Product-list URL/API param and chip label for each vehicle search list.
export const VEHICLE_SEARCH_FIELDS: { key: keyof ProductVehicleSearch; param: string; label: string }[] = [
  { key: "makes", param: "makes", label: "Make" },
  { key: "models", param: "models", label: "Model" },
  { key: "modelCodes", param: "model_codes", label: "Code" },
  { key: "years", param: "years", label: "Year" },
];
