import { z } from "zod";

export const sendProductEmailFormSchema = z.object({
  name: z.string().trim().min(1, "Recipient name is required"),
  email: z.string().trim().min(1, "Recipient email is required").email("Enter a valid email address"),
});

export type SendProductEmailFormValues = z.infer<typeof sendProductEmailFormSchema>;
