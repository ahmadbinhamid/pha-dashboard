import { z } from "zod";

// Tracking fields are only required when the modal is actually asking for
// them (a delivery order with no tracking on file yet) — a schema factory
// since that's a caller-supplied condition, not something derivable from
// the form's own field values.
export function sendOrderEmailFormSchema(needsTrackingInput: boolean) {
  return z.object({
    tracking_number: needsTrackingInput
      ? z.string().trim().min(1, "Tracking number is required")
      : z.string(),
    carrier_name: needsTrackingInput
      ? z.string().trim().min(1, "Carrier name is required")
      : z.string(),
  });
}

export type SendOrderEmailFormValues = z.infer<ReturnType<typeof sendOrderEmailFormSchema>>;
