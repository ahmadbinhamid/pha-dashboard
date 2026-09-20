import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/utils/cn";

export type IntegrationStatus = "connected" | "not_connected" | "error" | "unknown";

const STATUS_BADGE: Record<IntegrationStatus, { label: string; variant: "ok" | "danger" | "muted" }> = {
  connected: { label: "Connected", variant: "ok" },
  error: { label: "Needs attention", variant: "danger" },
  not_connected: { label: "Not connected", variant: "muted" },
  unknown: { label: "Configure", variant: "muted" },
};

// One tile in the Integrations catalogue. Status comes from the caller —
// each provider knows its own connection state through a different endpoint,
// so this component never fetches.
export function IntegrationCard({
  name,
  description,
  icon,
  // Brand logos (eBay/Google/a tenant's own uploaded storefront logo) sit on
  // a neutral chip instead of the accent-tinted circle — a partner's logo
  // (or a tenant's own) tinted orange would read as broken branding, not
  // "on theme".
  logoTile = false,
  status = "unknown",
  onManage,
}: {
  name: string;
  description: string;
  icon: React.ReactNode;
  logoTile?: boolean;
  status?: IntegrationStatus;
  onManage: () => void;
}) {
  const badge = STATUS_BADGE[status];

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl",
            logoTile ? "bg-bg-2 ring-1 ring-inset ring-border p-2" : "bg-accent/10 text-accent",
          )}
        >
          {icon}
        </span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <h3 className="mt-4 text-sm font-bold text-fg">{name}</h3>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-fg/55">{description}</p>

      <Button variant="outline" size="sm" className="mt-4 w-full gap-1.5" onClick={onManage}>
        {status === "connected" ? "Manage" : "Set up"}
        <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </Card>
  );
}
