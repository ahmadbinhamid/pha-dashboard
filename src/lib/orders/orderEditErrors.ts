import { ORDER_EDIT_CONFLICT_MESSAGES } from "@/config/orderEdit";
import type { OrderEditConflictCode } from "@/types/orders";

/** Staff-facing text for a failed order edit. */
export function orderEditErrorMessage(err: Error & { code?: string }): string {
  return ORDER_EDIT_CONFLICT_MESSAGES[err.code as OrderEditConflictCode] ?? err.message;
}
