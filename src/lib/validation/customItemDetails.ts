import { z } from "zod";
import { customItemTitleSchema, optionalAuthenticitySchema, optionalConditionSchema } from "@/lib/validation/customOrderItem";

export const customItemDetailsSchema = z.object({
  name: customItemTitleSchema,
  condition: optionalConditionSchema,
  authenticity: optionalAuthenticitySchema,
});

export type CustomItemDetailsFormValues = z.infer<typeof customItemDetailsSchema>;
