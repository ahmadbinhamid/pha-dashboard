import { z } from "zod";

// Mirrors server access.validation.js to catch API rejections early.

export const inviteMemberSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(60),
  last_name: z.string().trim().min(1, "Last name is required").max(60),
  email: z.string().trim().min(1, "An email address is required").email("Enter a valid email address"),
});
export type InviteMemberFormValues = z.infer<typeof inviteMemberSchema>;

export const roleFormSchema = z.object({
  name: z.string().trim().min(2, "Give the role a name").max(60, "Keep the name under 60 characters"),
  description: z.string().trim().max(200, "Keep the description under 200 characters").optional().or(z.literal("")),
  permissions: z.array(z.string()).min(1, "Select at least one permission"),
});
export type RoleFormValues = z.infer<typeof roleFormSchema>;
