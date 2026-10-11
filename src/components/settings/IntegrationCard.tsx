import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/utils/cn";
import { CHANNEL_COMING_SOON_LABEL } from "@/config/channelConnect";

export type IntegrationStatus = "connected" | "not_connected" | "error" | "unknown" | "coming_soon";

const STATUS_BADGE: Record<IntegrationStatus, { label: string; variant: "ok" | "danger" | "muted" }> = {
  connected: { label: "Connected", variant: "ok" },
  error: { label: "Needs attention", variant: "danger" },
  not_connected: { label: "Not connected", variant: "muted" },
  unknown: { label: "Configure", variant: "muted" },
  coming_soon: { label: CHANNEL_COMING_SOON_LABEL, variant: "muted" },
};

// Integrations tile; status comes from the caller, so it never fetches.
export function IntegrationCard({
  name,
  description,
  icon,
  // Brand logos sit on a neutral chip; tinted orange they'd look broken.
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

      <Button variant="outline" size="sm" className="mt-4 w-full gap-1.5" onClick={onManage} disabled={status === "coming_soon"}>
        {status === "coming_soon" ? CHANNEL_COMING_SOON_LABEL : status === "connected" ? "Manage" : "Set up"}
        {status !== "coming_soon" && <ArrowRight className="h-3.5 w-3.5" />}
      </Button>
    </Card>
  );
}
