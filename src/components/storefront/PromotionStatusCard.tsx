import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldDensityProvider } from "@/components/ui/FieldDensity";
import { Switch } from "@/components/ui/Switch";
import { SaleCountdown } from "@/components/storefront/SaleCountdown";
import { DISCOUNT_STATUS_CONFIG } from "@/config/discounts";
import { discountHeadline } from "@/lib/discounts/discountDisplay";
import type { FeaturedDiscount } from "@/types/discount";
import { cn } from "@/utils/cn";

interface PromotionStatusCardProps {
  // The saved featured discount, edits below don't change this card.
  discount: FeaturedDiscount | null;
  active: boolean;
  live: boolean;
  canToggle: boolean;
  toggling: boolean;
  onToggle: (active: boolean) => void;
}

function statusLine({ discount, active, live }: Pick<PromotionStatusCardProps, "discount" | "active" | "live">) {
  if (!discount) return "Pick a discount below, or quick-launch one.";
  if (live) return discount.ends_at ? null : "Running with no end date.";
  if (!active) return "Switched off. Turn it on to show it on your storefront.";
  return `Not showing: the discount is ${DISCOUNT_STATUS_CONFIG[discount.status].label.toLowerCase()}.`;
}

/** What shoppers see right now, with the instant on/off switch. */
export function PromotionStatusCard({ discount, active, live, canToggle, toggling, onToggle }: PromotionStatusCardProps) {
  const line = statusLine({ discount, active, live });
  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", live ? "bg-accent/15 text-accent" : "bg-bg-2 text-fg/40")}>
          <Zap className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-base font-semibold text-fg">
              {discount ? `${discountHeadline(discount)} · ${discount.code ?? "Automatic"}` : "Nothing promoted yet"}
            </span>
            <Badge variant={live ? "ok" : "muted"}>{live ? "Live on storefront" : active ? "Not live" : "Off"}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-fg/60">
            {line ?? (
              <>
                {discount?.name} · <SaleCountdown endsAt={discount?.ends_at ?? null} className="text-accent" />
              </>
            )}
          </p>
        </div>
      </div>
      <FieldDensityProvider density="compact">
        <Switch
          checked={active}
          onCheckedChange={onToggle}
          disabled={!canToggle}
          loading={toggling}
          label={active ? "Promotion on" : "Promotion off"}
          className="sm:w-52"
        />
      </FieldDensityProvider>
    </Card>
  );
}
