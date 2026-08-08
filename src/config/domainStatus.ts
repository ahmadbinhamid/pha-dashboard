import type { DomainStatus } from "@/types/domain";

type BadgeVariant = "default" | "ok" | "warn" | "danger" | "muted" | "outline";

export const DOMAIN_STATUS_CONFIG: Record<DomainStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Pending Verification", variant: "warn" },
  active: { label: "Verified", variant: "ok" },
  suspended: { label: "Suspended", variant: "danger" },
};
