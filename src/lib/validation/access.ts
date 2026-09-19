import { z } from "zod";

// Mirrors server/src/validators/access.validation.js, so the dialog catches
// what the API would reject before a round trip.

export const inviteMemberSchema = z.object({
  email: z.string().trim().min(1, "An email address is required").email("Enter a valid email address"),
  role_id: z.string().min(1, "Choose a role"),
});
export type InviteMemberFormValues = z.infer<typeof inviteMemberSchema>;

export const roleFormSchema = z.object({
  name: z.string().trim().min(2, "Give the role a name").max(60, "Keep the name under 60 characters"),
  description: z.string().trim().max(200, "Keep the description under 200 characters").optional().or(z.literal("")),
  permissions: z.array(z.string()).min(1, "Select at least one permission"),
});
export type RoleFormValues = z.infer<typeof roleFormSchema>;
