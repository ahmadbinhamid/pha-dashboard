import type { OrderEditConflictCode } from "@/types/orders";

// What staff see for each order-edit 409; others fall back to the server text.
export const ORDER_EDIT_CONFLICT_MESSAGES: Partial<Record<OrderEditConflictCode, string>> = {
  payment_in_flight: "A payment has just been made on this order. Reload to see it.",
  version_conflict: "This order was changed by someone else. Reload to see the latest.",
};

// Customer-facing: an edit cancelled the payment this page was opened with.
export const ORDER_CHANGED_DURING_PAYMENT_MESSAGE =
  "This order was updated since you opened this page. Check the new amount before paying.";

export const ORDER_PAYMENT_LINK_EDIT_NOTE =
  "The customer's existing payment link stays valid and will show the new total.";
