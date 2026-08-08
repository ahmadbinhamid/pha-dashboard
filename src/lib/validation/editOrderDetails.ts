import { z } from "zod";
import { addressFieldsSchema, requiredAddressSchema } from "@/lib/validation/address";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pickup orders have no address section at all — factory since which
// address rules apply depends on the order's delivery method, not on
// another form field.
export function editOrderDetailsFormSchema(isPickup: boolean) {
  return z
    .object({
      name: z.string().trim().min(1, "Name is required"),
      email: z.string().trim(),
      phone: z.string(),
      shippingAddress: addressFieldsSchema,
      useDifferentBilling: z.boolean(),
      billingAddress: addressFieldsSchema,
    })
    .superRefine((values, ctx) => {
      if (values.email && !EMAIL_RE.test(values.email)) {
        ctx.addIssue({ code: "custom", message: "Enter a valid email", path: ["email"] });
      }

      if (isPickup) return;

      const shippingCheck = requiredAddressSchema.safeParse(values.shippingAddress);
      if (!shippingCheck.success) {
        for (const issue of shippingCheck.error.issues) {
          ctx.addIssue({ code: "custom", message: issue.message, path: ["shippingAddress", ...issue.path] });
        }
      }

      if (values.useDifferentBilling) {
        const billingCheck = requiredAddressSchema.safeParse(values.billingAddress);
        if (!billingCheck.success) {
          for (const issue of billingCheck.error.issues) {
            ctx.addIssue({ code: "custom", message: issue.message, path: ["billingAddress", ...issue.path] });
          }
        }
      }
    });
}

export type EditOrderDetailsFormValues = z.infer<ReturnType<typeof editOrderDetailsFormSchema>>;
