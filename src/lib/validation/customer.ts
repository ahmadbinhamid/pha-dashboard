import { z } from "zod";
import { addressFieldsSchema, isAddressFilled, validatePartialAddress } from "@/lib/validation/address";

// Digits and phone punctuation only, mirrors the backend PHONE_PATTERN.
export const PHONE_PATTERN = /^[\d\s\-()+]*$/;

export const customerFormSchema = z
  .object({
    name: z.string().trim().min(1, "Customer name is required"),
    businessName: z.string().trim(),
    email: z.string().trim(),
    phone: z.string().regex(PHONE_PATTERN, "Phone number cannot contain letters"),
    shippingAddress: addressFieldsSchema,
    useDifferentBilling: z.boolean(),
    billingAddress: addressFieldsSchema,
  })
  // An address is optional, but one started must be finished.
  .superRefine((values, ctx) => {
    const shippingErrors = validatePartialAddress(values.shippingAddress);
    for (const [key, message] of Object.entries(shippingErrors)) {
      ctx.addIssue({ code: "custom", message, path: ["shippingAddress", key] });
    }

    if (values.useDifferentBilling) {
      if (!isAddressFilled(values.billingAddress)) {
        ctx.addIssue({ code: "custom", message: "Billing address is required", path: ["billingAddress", "address"] });
      } else {
        const billingErrors = validatePartialAddress(values.billingAddress);
        for (const [key, message] of Object.entries(billingErrors)) {
          ctx.addIssue({ code: "custom", message, path: ["billingAddress", key] });
        }
      }
    }
  });

export type CustomerFormValues = z.infer<typeof customerFormSchema>;
