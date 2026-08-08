import { z } from "zod";

export const paymentDomainFormSchema = z.object({
  payment_domain_mode: z.enum(["default", "vendor_slug"]),
});

export type PaymentDomainFormValues = z.infer<typeof paymentDomainFormSchema>;
