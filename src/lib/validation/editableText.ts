import { z } from "zod";

// Optional free text — blank is valid (clears the field).
export const editableTextFormSchema = z.object({
  value: z.string(),
});

export type EditableTextFormValues = z.infer<typeof editableTextFormSchema>;
