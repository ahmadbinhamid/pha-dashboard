import type { Discount, FeaturedDiscount } from "@/types/discount";
import type { Category, Product } from "@/types/product";
import type { FlashSale, PromotedSale } from "@/types/storefront";

/** Selected category ids plus all descendants, as the server resolves them. */
export function expandCategoryIds(categories: Pick<Category, "_id" | "parent">[], selected: string[]) {
  const result = new Set<string>();
  const queue = [...selected];
  for (let i = 0; i < queue.length; i += 1) {
    if (result.has(queue[i])) continue;
    result.add(queue[i]);
    categories.filter((c) => c.parent === queue[i]).forEach((c) => queue.push(c._id));
  }
  return result;
}

/** A listed discount with its targeting expanded, ready to feature. */
export function toFeaturedDiscount(discount: Discount, categories: Category[]): FeaturedDiscount {
  const eligible = discount.scope === "categories" ? [...expandCategoryIds(categories, discount.category_ids)] : [];
  return { ...discount, eligible_category_ids: eligible };
}

/** Just the "how it's shown" settings of a promotion. */
function promotionDisplay({ active: _active, discount_id: _discountId, ...display }: FlashSale) {
  return display;
}

/** The sale shoppers would see, or null unless featured, on, and live. */
export function toPromotedSale(flashSale: FlashSale, discount: FeaturedDiscount | null): PromotedSale | null {
  if (!flashSale.active || !discount || discount.status !== "live") return null;
  const { name, code, is_automatic, discount_type, discount_value, scope, eligible_category_ids, ends_at } = discount;
  return { name, code, is_automatic, discount_type, discount_value, scope, eligible_category_ids, ends_at, ...promotionDisplay(flashSale) };
}

/** Whether a product falls inside the sale's (pre-expanded) targeting. */
export function isProductOnSale(product: Pick<Product, "categories">, sale: PromotedSale) {
  if (sale.scope === "storewide") return true;
  return (product.categories ?? []).some((c) => sale.eligible_category_ids.includes(c._id));
}

/** Unit sale price for % Off, other deal types discount at checkout. */
export function salePrice(price: number, sale: Pick<PromotedSale, "discount_type" | "discount_value">) {
  if (sale.discount_type !== "percent") return null;
  return Math.round(price * (100 - sale.discount_value)) / 100;
}

export function saleHeadline(sale: Pick<PromotedSale, "discount_type" | "discount_value">) {
  if (sale.discount_type === "percent") return `${sale.discount_value}% OFF`;
  if (sale.discount_type === "fixed") return `$${sale.discount_value} OFF`;
  return "FREE SHIPPING";
}

/** Ticker copy: the custom line, else the offer and how to get it. */
export function saleTickerText(sale: PromotedSale) {
  if (sale.ticker_text) return sale.ticker_text;
  return sale.code ? `${saleHeadline(sale)} with code ${sale.code}` : `${saleHeadline(sale)}, applied at checkout`;
}
