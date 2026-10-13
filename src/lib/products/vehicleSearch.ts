import { EMPTY_VEHICLE_SEARCH, VEHICLE_SEARCH_FIELDS } from "@/config/fitment";
import type { ProductVehicleSearch } from "@/types/product";

const splitList = (value: string | null) => (value ? value.split(",").map((v) => v.trim()).filter(Boolean) : []);

/** Vehicle search as read from the product-list URL. */
export function vehicleSearchFromParams(params: URLSearchParams): ProductVehicleSearch {
  return VEHICLE_SEARCH_FIELDS.reduce(
    (search, { key, param }) => ({ ...search, [key]: splitList(params.get(param)) }),
    EMPTY_VEHICLE_SEARCH,
  );
}

// NOTE: comma-joined like categories; empty lists are left out entirely.
export function vehicleSearchToQuery(search: ProductVehicleSearch): Record<string, string> {
  return Object.fromEntries(
    VEHICLE_SEARCH_FIELDS.filter(({ key }) => search[key].length).map(({ key, param }) => [param, search[key].join(",")]),
  );
}

export const isVehicleSearchEmpty = (search: ProductVehicleSearch) => VEHICLE_SEARCH_FIELDS.every(({ key }) => !search[key].length);

// NOTE: emptying a parent list clears its children; partial edits keep them.
export function withVehicleList(search: ProductVehicleSearch, key: keyof ProductVehicleSearch, values: string[]): ProductVehicleSearch {
  const next = { ...search, [key]: values };
  if (values.length) return next;
  if (key === "makes") return { ...next, models: [], modelCodes: [] };
  if (key === "models") return { ...next, modelCodes: [] };
  return next;
}

// "AION, Audi +1": first `shown` values, then how many more.
export function summarizeList(values: string[], shown = 2): string {
  const head = values.slice(0, shown).join(", ");
  return values.length > shown ? `${head} +${values.length - shown}` : head;
}

export const vehicleFilterCount = (search: ProductVehicleSearch) =>
  VEHICLE_SEARCH_FIELDS.reduce((sum, { key }) => sum + search[key].length, 0);
