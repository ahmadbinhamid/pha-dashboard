import { z } from "zod";

// Mirrors the backend's HOSTNAME_PATTERN (server/src/validators/domain.validation.js)
// — kept in sync manually, same as the DNS verification subdomain prefix
// (see DomainRow.tsx). Client-side validation here is purely for fast
// feedback; the backend re-validates and is the actual source of truth.
const HOSTNAME_PATTERN = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.(?!-)[a-zA-Z0-9-]{1,63}(?<!-))+$/;

export const addDomainSchema = z.object({
  hostname: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Enter a domain")
    .max(253, "Domain is too long")
    .regex(HOSTNAME_PATTERN, "Enter a valid domain (e.g. shop.example.com)"),
});

export type AddDomainFormValues = z.infer<typeof addDomainSchema>;
