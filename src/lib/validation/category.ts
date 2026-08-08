import { z } from "zod";
import type { Attachment } from "@/types/product";

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Category name is required"),
  description: z.string(),
  thumbnail: z.custom<Attachment | null>().nullable(),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
