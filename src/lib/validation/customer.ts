import { z } from "zod";
import { addressFieldsSchema, isAddressFilled, validatePartialAddress } from "@/lib/validation/address";

// Digits plus common phone punctuation — no letters, mirrors the backend's
// PHONE_PATTERN in customer.validation.js.
const PHONE_PATTERN = /^[\d\s\-()+]*$/;

export const customerFormSchema = z
  .object({
    name: z.string().trim().min(1, "Customer name is required"),
    email: z.string().trim(),
    phone: z.string().regex(PHONE_PATTERN, "Phone number cannot contain letters"),
    shippingAddress: addressFieldsSchema,
    useDifferentBilling: z.boolean(),
    billingAddress: addressFieldsSchema,
  })
  // Shipping address: optional as a whole, but if any field is filled the
  // rest become required (a half-typed address shouldn't silently save as
  // empty). Billing address: same rule, but only enforced at all when
  // "use a different billing address" is checked.
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
