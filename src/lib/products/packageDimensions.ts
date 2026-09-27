import type { PackageDimensions, PackageFormState } from "@/types/product";

// Product and eBay listing share these; "" / null both mean "not set".
export const EMPTY_PACKAGE_FORM: PackageFormState = { length: "", width: "", height: "", weight: "" };

export const PACKAGE_KEYS = ["length", "width", "height", "weight"] as const;

export function packageToForm(pkg: PackageDimensions | null | undefined): PackageFormState {
  return Object.fromEntries(PACKAGE_KEYS.map((k) => [k, pkg?.[k] != null ? String(pkg[k]) : ""])) as unknown as PackageFormState;
}

export function packageFromForm(form: PackageFormState): PackageDimensions {
  return Object.fromEntries(PACKAGE_KEYS.map((k) => [k, form[k].trim() === "" ? null : Number(form[k])])) as unknown as PackageDimensions;
}

export function hasPackageValue(pkg: Partial<Record<keyof PackageFormState, unknown>> | null | undefined): boolean {
  return PACKAGE_KEYS.some((k) => pkg?.[k] != null && String(pkg[k]).trim() !== "");
}

/** e.g. "30 × 20 × 10 cm · 1.5 kg"; null when nothing is set. */
export function formatPackage(pkg: PackageDimensions | null | undefined): string | null {
  if (!pkg || !hasPackageValue(pkg)) return null;
  const dims = [pkg.length, pkg.width, pkg.height].map((d) => (d != null ? String(d) : "–"));
  const size = dims.every((d) => d === "–") ? null : `${dims.join(" × ")} cm`;
  const weight = pkg.weight != null ? `${pkg.weight} kg` : null;
  return [size, weight].filter(Boolean).join(" · ");
}

/** Package fields still blank; calculated shipping needs all four. */
export function missingPackageFields(form: PackageFormState): (typeof PACKAGE_KEYS)[number][] {
  return PACKAGE_KEYS.filter((k) => !form[k].trim());
}
