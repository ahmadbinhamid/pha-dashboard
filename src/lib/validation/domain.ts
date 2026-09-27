import { z } from "zod";

// Mirrors the backend's HOSTNAME_PATTERN (domain.validation.js), kept in sync manually. Purely for fast feedback — the backend re-validates and is the source of truth.
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
