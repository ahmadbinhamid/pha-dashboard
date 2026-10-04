import { z } from "zod";
import { priceSchema, optionalNonNegativePriceSchema } from "@/lib/validation/commonFields";
import { vehicleYearRangeSchema } from "@/lib/validation/commonFields";
import type { PackageFormState, StockEntry } from "@/types/product";
import { missingPackageFields } from "@/lib/products/packageDimensions";
import type { Attachment } from "@/types/product";
import type { FitmentRowFormState } from "@/types/marketplace";

// Price, package and year are checked; the rest stay permissive.
const productFormShape = {
  title: z.string().trim().min(1, "Title is required"),
  description: z.string(),
  price: z.string(),
  compare_price: z.string(),
  cost_price: z.string(),
  shipping_cost: z.string(),
  is_taxable: z.boolean(),
  barcode: z.string(),
  mpn: z.string(),
  condition: z.string(),
  authenticity: z.string(),
  // First row is the default vehicle; the rest are additional fitments.
  fitments: z.array(
    z.object({ make: z.string(), model: z.string(), model_code: z.string(), year_from: z.string(), year_to: z.string() }),
  ),
  package: z.object({
    length: optionalNonNegativePriceSchema("Length"),
    width: optionalNonNegativePriceSchema("Width"),
    height: optionalNonNegativePriceSchema("Height"),
    weight: optionalNonNegativePriceSchema("Weight"),
  }),
  bay: z.string().trim().max(40, "Bay must be 40 characters or fewer"),
  shipping_method: z.enum(["standard", "calculated", "pickup"]),
  tailgate_pickup: z.boolean(),
  tailgate_delivery: z.boolean(),
  type: z.string(),
  status: z.string(),
  is_published_online: z.boolean(),
  categories: z.array(z.string()),
  tags: z.array(z.string()),
  images: z.custom<Attachment[]>(),
};

function withPriceAndYearChecks<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).superRefine((values, ctx) => {
    const price = priceSchema("Retail price").safeParse((values as { price: string }).price);
    if (!price.success) {
      ctx.addIssue({ code: "custom", message: price.error.issues[0]?.message ?? "Retail price is required", path: ["price"] });
    }

    const cost = optionalNonNegativePriceSchema("Cost price").safeParse((values as { cost_price: string }).cost_price);
    if (!cost.success) {
      ctx.addIssue({ code: "custom", message: cost.error.issues[0]?.message ?? "Invalid cost price", path: ["cost_price"] });
    }

    const shipping = optionalNonNegativePriceSchema("Shipping cost").safeParse(
      (values as { shipping_cost: string }).shipping_cost,
    );
    if (!shipping.success) {
      ctx.addIssue({
        code: "custom",
        message: shipping.error.issues[0]?.message ?? "Invalid shipping cost",
        path: ["shipping_cost"],
      });
    }

    // Transdirect can't quote without every dimension and the weight.
    const pkg = (values as { package: PackageFormState }).package;
    if ((values as { shipping_method: string }).shipping_method === "calculated") {
      for (const key of missingPackageFields(pkg)) {
        ctx.addIssue({ code: "custom", message: "Calculated shipping needs every package field", path: ["package", key] });
      }
    }

    (values as { fitments: FitmentRowFormState[] }).fitments.forEach((row, index) => {
      const yearResult = vehicleYearRangeSchema.safeParse({ year_from: row.year_from, year_to: row.year_to });
      if (!yearResult.success) {
        ctx.addIssue({
          code: "custom",
          message: yearResult.error.issues[0]?.message ?? "Invalid year range",
          path: ["fitments", index, "year_to"],
        });
      }
    });
  });
}

// One shape for create and edit; each mode ignores the other's extras.
export const productFormSchema = withPriceAndYearChecks({
  ...productFormShape,
  sku: z.string(),
  brand: z.string(),
  has_variants: z.boolean(),
  choices: z.custom<import("@/types/product").Choice[]>(),
  stock_entries: z.custom<StockEntry[]>(),
  notes: z.array(z.string()),
});

// Create also needs the opening quantity (stock is always tracked, no toggle).
export const productCreateFormSchema = productFormSchema.superRefine((values, ctx) => {
  const qty = values.stock_entries[0]?.qty;
  if (values.stock_entries.length === 0 || typeof qty !== "number" || qty < 0) {
    ctx.addIssue({ code: "custom", message: "Stock quantity is required", path: ["stock_entries"] });
  }
});

export type ProductFormValues = z.infer<typeof productFormSchema>;
