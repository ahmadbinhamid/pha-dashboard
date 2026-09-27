import { z } from "zod";

// Tracking fields are only required when the modal is asking for them — a factory since that's caller-supplied, not derivable from the form's own values.
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
