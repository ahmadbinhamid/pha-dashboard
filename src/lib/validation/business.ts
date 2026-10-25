import { z } from "zod";
import { PHONE_PATTERN } from "@/lib/validation/customer";

export const representativeSchema = z.object({
  name: z.string().trim().min(1, "Representative name is required"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  phone: z.string().regex(PHONE_PATTERN, "Phone number cannot contain letters"),
});

export const businessFormSchema = z
  .object({
    name: z.string().trim().min(1, "Business name is required"),
    // SingleSelect value: "" for no terms, else the day count as a string.
    payment_terms_days: z.string(),
    representatives: z.array(representativeSchema),
  })
  // Mirrors the server: one name+email pair per business, case aside.
  .superRefine((values, ctx) => {
    const seen = new Set<string>();
    values.representatives.forEach((rep, index) => {
      if (!rep.email) return;
      const key = `${rep.name.trim().toLowerCase()}|${rep.email.trim().toLowerCase()}`;
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", message: "Already added above", path: ["representatives", index, "name"] });
      }
      seen.add(key);
    });
  });

export type BusinessFormValues = z.infer<typeof businessFormSchema>;
export type RepresentativeFormValues = z.infer<typeof representativeSchema>;

export const EMPTY_REPRESENTATIVE: RepresentativeFormValues = { name: "", email: "", phone: "" };
