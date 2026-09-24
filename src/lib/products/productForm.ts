import type { ProductFormValues } from "@/lib/validation/product";
import type { Product } from "@/types/product";

export type ProductFormMode = "create" | "edit";

// A new product's starting values (create mode).
export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  title: "",
  description: "",
  price: "",
  compare_price: "",
  cost_price: "",
  shipping_cost: "",
  is_taxable: false,
  sku: "",
  barcode: "",
  brand: "",
  mpn: "",
  condition: "NEW",
  authenticity: "",
  vehicle_make: "",
  vehicle_model: "",
  vehicle_model_code: "",
  vehicle_year: "",
  vehicle_year_to: "",
  type: "physical",
  status: "active",
  is_published_online: true,
  has_variants: false,
  categories: [],
  tags: [],
  images: [],
  choices: [],
  stock_entries: [],
  notes: [],
};

export function productToForm(p: Product): ProductFormValues {
  return {
    ...EMPTY_PRODUCT_FORM,
    title: p.title,
    description: p.description,
    price: p.price?.toString() ?? "",
    compare_price: p.compare_price?.toString() ?? "",
    cost_price: p.cost_price?.toString() ?? "",
    shipping_cost: p.shipping_cost?.toString() ?? "",
    is_taxable: p.is_taxable,
    sku: p.sku ?? "",
    barcode: p.barcode ?? "",
    brand: p.brand ?? "",
    mpn: p.mpn ?? "",
    condition: p.condition,
    authenticity: p.authenticity ?? "",
    vehicle_make: p.vehicle?.make ?? "",
    vehicle_model: p.vehicle?.model ?? "",
    vehicle_model_code: p.vehicle?.model_code ?? "",
    vehicle_year: p.vehicle?.year_from != null ? String(p.vehicle.year_from) : "",
    vehicle_year_to: p.vehicle?.year_to != null ? String(p.vehicle.year_to) : "",
    type: p.type,
    status: p.status,
    is_published_online: p.is_published_online,
    has_variants: p.has_variants,
    categories: p.categories?.map((c) => c._id) ?? [],
    tags: p.tags ?? [],
    images: p.attachments ?? [],
    choices: p.choices?.map((c) => ({ name: c.name, items: c.items })) ?? [],
  };
}

/** Multipart body; edit sends blanks so fields can be cleared. */
export function productFormToFormData(form: ProductFormValues, mode: ProductFormMode, status: string = form.status): FormData {
  const fd = new FormData();
  const edit = mode === "edit";
  // Create omits empty optionals; edit sends "" to clear them.
  const optional = (key: string, value: string) => {
    if (edit || value) fd.append(key, value);
  };

  fd.append("title", form.title.trim());
  fd.append("description", form.description);
  fd.append("price", form.price || "0");
  optional("compare_price", form.compare_price);
  optional("cost_price", form.cost_price);
  optional("shipping_cost", form.shipping_cost);
  fd.append("is_taxable", String(form.is_taxable));
  fd.append("barcode", form.barcode);
  optional("mpn", edit ? form.mpn : form.mpn.trim());
  fd.append("condition", form.condition);
  optional("authenticity", form.authenticity);
  fd.append(
    "vehicle",
    JSON.stringify({
      make: form.vehicle_make || null,
      model: form.vehicle_model || null,
      model_code: form.vehicle_model_code || null,
      year_from: form.vehicle_year ? Number(form.vehicle_year) : null,
      year_to: form.vehicle_year_to ? Number(form.vehicle_year_to) : null,
    }),
  );
  fd.append("type", form.type);
  fd.append("status", status);
  fd.append("is_published_online", String(form.is_published_online));
  // Stock is always tracked; there's no "track stock" toggle in the UI.
  fd.append("stock_control", "true");
  fd.append("categories", JSON.stringify(form.categories));
  fd.append("tags", JSON.stringify(form.tags));
  fd.append("attachments", JSON.stringify(form.images.map((img) => img._id || img.id).filter(Boolean)));

  if (edit) {
    fd.append("sku", form.sku);
    fd.append("brand", form.brand);
    fd.append("has_variants", String(form.has_variants));
    fd.append("choices", JSON.stringify(form.choices));
  } else if (form.stock_entries.length > 0) {
    fd.append("stock_entries", JSON.stringify(form.stock_entries));
  }
  return fd;
}

