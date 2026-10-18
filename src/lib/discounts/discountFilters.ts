import type { Discount, DiscountListFilter } from "@/types/discount";

const INACTIVE = new Set(["paused", "ended", "exhausted"]);

export function filterDiscounts(discounts: Discount[], filter: DiscountListFilter, search: string) {
  const q = search.trim().toLowerCase();
  return discounts.filter((d) => {
    if (filter === "live" && d.status !== "live") return false;
    if (filter === "scheduled" && d.status !== "scheduled") return false;
    if (filter === "inactive" && !INACTIVE.has(d.status)) return false;
    return !q || d.name.toLowerCase().includes(q) || (d.code ?? "").toLowerCase().includes(q);
  });
}

/** Live automatic deals that can compete for one order (best one wins). */
export function overlappingAutomaticCount(discounts: Discount[]) {
  const live = discounts.filter((d) => d.status === "live" && d.is_automatic);
  // Open-ended deals overlap every other, for the rest, count per first order #.
  const open = live.filter((d) => d.min_order_number == null && d.max_order_number == null).length;
  const byStart = new Map<number, number>();
  for (const d of live) {
    if (d.min_order_number == null && d.max_order_number == null) continue;
    const start = d.min_order_number ?? 1;
    byStart.set(start, (byStart.get(start) ?? 0) + 1);
  }
  return open + Math.max(0, ...byStart.values());
}
