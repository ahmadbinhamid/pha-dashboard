export const ORDER_DRAFT_STORAGE_KEY = "pha-dashboard-create-order-wizard";

export function clearOrderDraft() {
  try {
    localStorage.removeItem(ORDER_DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
