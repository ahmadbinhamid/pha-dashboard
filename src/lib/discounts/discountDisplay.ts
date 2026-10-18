import type { Discount } from "@/types/discount";
import { formatCurrency } from "@/utils/format";

type Offer = Pick<Discount, "discount_type" | "discount_value">;
type OrderRange = Pick<Discount, "min_order_number" | "max_order_number">;

const dateFmt = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" });
const fmtDate = (iso: string) => dateFmt.format(new Date(iso));

/** "20% off", "$10.00 off", "Free shipping". */
export function discountHeadline(d: Offer) {
  if (d.discount_type === "percent") return `${d.discount_value}% off`;
  if (d.discount_type === "fixed") return `${formatCurrency(d.discount_value)} off`;
  return "Free shipping";
}

/** The conditions as one clause, e.g. "Orders over $50 · 2 categories". */
export function discountConditions(d: Pick<Discount, "minimum_order" | "scope" | "category_ids">) {
  const parts = [d.minimum_order > 0 ? `Orders over ${formatCurrency(d.minimum_order)}` : "Any order"];
  if (d.scope === "categories") parts.push(`${d.category_ids.length} categor${d.category_ids.length === 1 ? "y" : "ies"}`);
  return parts.join(" · ");
}

export function discountUsageLabel(d: Pick<Discount, "usage_count" | "usage_limit">) {
  return d.usage_limit == null ? `${d.usage_count} used` : `${d.usage_count} / ${d.usage_limit} used`;
}

/** "Starts 1 Nov · ends 5 Nov", "Until 5 Nov 2026", "No end date". */
export function discountSchedule(d: Pick<Discount, "starts_at" | "ends_at">) {
  const future = d.starts_at && new Date(d.starts_at).getTime() > Date.now();
  if (future && d.ends_at) return `${fmtDate(d.starts_at!)} to ${fmtDate(d.ends_at)}`;
  if (future) return `Starts ${fmtDate(d.starts_at!)}`;
  return d.ends_at ? `Until ${fmtDate(d.ends_at)}` : "No end date";
}

const ordinal = (n: number) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
};

/** e.g. "Any order", "First order", "3rd order onwards", "Orders 3 to 5". */
export function discountOrderLabel({ min_order_number: min, max_order_number: max }: OrderRange) {
  if (min === 1 && max === 1) return "First order";
  if (min && min === max) return `${ordinal(min)} order`;
  if (min && !max) return `${ordinal(min)} order onwards`;
  if (!min && max) return `First ${max} orders`;
  return min && max ? `Orders ${min} to ${max}` : "Any order";
}

function whoClause({ min_order_number: min, max_order_number: max }: OrderRange) {
  if (!min && !max) return "Customers";
  if (min === 1 && max === 1) return "New customers on their first order";
  if (min && min === max) return `Customers on their ${ordinal(min)} order`;
  if (min && !max) return `Customers from their ${ordinal(min)} order`;
  return `Customers on ${discountOrderLabel({ min_order_number: min, max_order_number: max }).toLowerCase()}`;
}

type Describable = Offer &
  OrderRange &
  Pick<Discount, "is_automatic" | "code" | "minimum_order" | "scope" | "category_ids" | "ends_at" | "usage_limit">;

/** The whole discount as one plain sentence, e.g. "Customers who…". */
export function describeDiscount(d: Describable) {
  const who = whoClause(d);
  const how = d.is_automatic ? `${who} automatically get` : `${who} who enter ${d.code || "the code"} get`;
  const parts = [`${how} ${discountHeadline(d).toLowerCase()}`];
  if (d.scope === "categories") parts.push(`on ${d.category_ids.length} categor${d.category_ids.length === 1 ? "y" : "ies"}`);
  if (d.minimum_order > 0) parts.push(`on orders over ${formatCurrency(d.minimum_order)}`);
  if (d.ends_at) parts.push(`until ${fmtDate(d.ends_at)}`);
  if (d.usage_limit) parts.push(`for the first ${d.usage_limit} uses`);
  return `${parts.join(" ")}.`;
}

/** Why a discount isn't applying right now, null when it's live. */
export function discountStatusReason(d: Pick<Discount, "status" | "starts_at" | "ends_at" | "usage_limit">) {
  if (d.status === "paused") return "Paused, so it won't apply";
  if (d.status === "scheduled" && d.starts_at) return `Starts ${fmtDate(d.starts_at)}`;
  if (d.status === "ended" && d.ends_at) return `Ended ${fmtDate(d.ends_at)}`;
  if (d.status === "exhausted") return `All ${d.usage_limit} uses taken`;
  return null;
}
