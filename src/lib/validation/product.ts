import { z } from "zod";
import { priceSchema, optionalNonNegativePriceSchema } from "@/lib/validation/commonFields";
import { vehicleYearRangeSchema } from "@/lib/validation/commonFields";
import type { StockEntry } from "@/types/product";
import type { Attachment } from "@/types/product";

// Fields the original hand-written validators (ProductCreatePage/EditPage)
// never checked (categories, images, stock entries, notes, etc.) stay
// permissive here too — this migration fixes the price/year validation
// gaps that were found live, not adds new restrictions nobody asked for.
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
  vehicle_make: z.string(),
  vehicle_model: z.string(),
  vehicle_model_code: z.string(),
  vehicle_year: z.string(),
  vehicle_year_to: z.string(),
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

    const v = values as { vehicle_year: string; vehicle_year_to: string };
    const yearResult = vehicleYearRangeSchema.safeParse({ year_from: v.vehicle_year, year_to: v.vehicle_year_to });
    if (!yearResult.success) {
      ctx.addIssue({
        code: "custom",
        message: yearResult.error.issues[0]?.message ?? "Invalid year range",
        path: ["vehicle_year_to"],
      });
    }
  });
}

export const productCreateFormSchema = withPriceAndYearChecks({
  ...productFormShape,
  stock_control: z.boolean(),
  stock_entries: z.custom<StockEntry[]>(),
  notes: z.array(z.string()),
});

export const productEditFormSchema = withPriceAndYearChecks({
  ...productFormShape,
  sku: z.string(),
  brand: z.string(),
  stock_control: z.boolean(),
  has_variants: z.boolean(),
  choices: z.custom<import("@/types/product").Choice[]>(),
});

export type ProductCreateFormValues = z.infer<typeof productCreateFormSchema>;
export type ProductEditFormValues = z.infer<typeof productEditFormSchema>;
