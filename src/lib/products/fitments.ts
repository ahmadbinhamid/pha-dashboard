import type { FitmentRowFormState } from "@/types/marketplace";
import type { ProductVehicle } from "@/types/product";

type FitmentSource = Partial<Record<keyof ProductVehicle, unknown>>;

const text = (v: unknown) => (v == null ? "" : String(v));
const year = (v: string) => (v ? Number(v) : null);

export function fitmentToForm(source: FitmentSource): FitmentRowFormState {
  return {
    make: text(source.make),
    model: text(source.model),
    model_code: text(source.model_code),
    year_from: text(source.year_from),
    year_to: text(source.year_to),
  };
}

export function fitmentFromForm(row: FitmentRowFormState): ProductVehicle {
  return {
    make: row.make || null,
    model: row.model || null,
    model_code: row.model_code || null,
    year_from: year(row.year_from),
    year_to: year(row.year_to),
  };
}

// Rows without a make or model are blank and never saved.
export const isNamedFitment = (row: FitmentRowFormState) => !!(row.make.trim() || row.model.trim());

/** Default vehicle first, then the additional fitments, as form rows. */
export function productFitmentsToForm(product: { vehicle?: ProductVehicle | null; additional_fitments?: ProductVehicle[] }) {
  return [product.vehicle, ...(product.additional_fitments ?? [])]
    .filter((v): v is ProductVehicle => !!v)
    .map(fitmentToForm)
    .filter(isNamedFitment);
}
