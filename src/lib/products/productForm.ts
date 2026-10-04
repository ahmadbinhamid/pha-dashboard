import type { ProductFormValues } from "@/lib/validation/product";
import type { Product } from "@/types/product";
import { EMPTY_PACKAGE_FORM, packageFromForm, packageToForm } from "@/lib/products/packageDimensions";
import { fitmentFromForm, isNamedFitment, productFitmentsToForm } from "@/lib/products/fitments";
import { EMPTY_FITMENT_ROW } from "@/config/fitment";

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
  fitments: [],
  package: EMPTY_PACKAGE_FORM,
  bay: "",
  shipping_method: "standard",
  tailgate_pickup: false,
  tailgate_delivery: false,
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
    fitments: productFitmentsToForm(p),
    package: packageToForm(p.package),
    bay: p.bay ?? "",
    shipping_method: p.shipping_method ?? "standard",
    tailgate_pickup: p.tailgate_pickup ?? false,
    tailgate_delivery: p.tailgate_delivery ?? false,
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
  const [defaultVehicle = EMPTY_FITMENT_ROW, ...additional] = form.fitments.filter(isNamedFitment);
  fd.append("vehicle", JSON.stringify(fitmentFromForm(defaultVehicle)));
  fd.append("additional_fitments", JSON.stringify(additional.map(fitmentFromForm)));
  fd.append("package", JSON.stringify(packageFromForm(form.package)));
  optional("bay", form.bay.trim());
  fd.append("shipping_method", form.shipping_method);
  fd.append("tailgate_pickup", String(form.tailgate_pickup));
  fd.append("tailgate_delivery", String(form.tailgate_delivery));
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

