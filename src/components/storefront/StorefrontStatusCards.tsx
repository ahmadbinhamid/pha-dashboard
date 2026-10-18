import { useQuery } from "@tanstack/react-query";
import { Images, Megaphone, TicketPercent, Zap } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { DISCOUNTS_QUERY_KEY, getDiscounts } from "@/lib/api/discounts";
import { saleHeadline, toPromotedSale } from "@/lib/storefront/salePricing";
import type { StorefrontSettings, StorefrontTab } from "@/types/storefront";

interface StorefrontStatusCardsProps {
  settings: StorefrontSettings;
  active: StorefrontTab;
  onSelect: (tab: StorefrontTab) => void;
  // Hidden for members without discounts.view.
  showDiscounts: boolean;
}

function saleSummary(discount: StorefrontSettings["featured_discount"]) {
  if (!discount) return "No discount featured";
  return `${discount.code ?? "Automatic"} · ${saleHeadline(discount)}`;
}

/** At-a-glance state of each section, doubles as the section switcher. */
export function StorefrontStatusCards({ settings, active, onSelect, showDiscounts }: StorefrontStatusCardsProps) {
  const { hero_slides, announcement, flash_sale, featured_discount } = settings;
  const liveSlides = hero_slides.filter((s) => s.active).length;
  const saleLive = !!toPromotedSale(flash_sale, featured_discount);
  const { data: discountsRes } = useQuery({ queryKey: DISCOUNTS_QUERY_KEY, queryFn: getDiscounts, enabled: showDiscounts });
  const discounts = discountsRes?.data ?? [];
  const liveDiscounts = discounts.filter((d) => d.status === "live").length;
  const scheduled = discounts.filter((d) => d.status === "scheduled").length;

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={Images}
        label="Hero carousel"
        active={active === "hero"}
        onClick={() => onSelect("hero")}
        aside={<Badge variant={liveSlides ? "ok" : "muted"}>{liveSlides ? "Live" : "Empty"}</Badge>}
      >
        {hero_slides.length ? `${liveSlides} of ${hero_slides.length} slides showing` : "No slides yet"}
      </StatCard>
      <StatCard
        icon={Megaphone}
        label="Welcome banner"
        active={active === "announcement"}
        onClick={() => onSelect("announcement")}
        aside={<Badge variant={announcement.enabled ? "ok" : "muted"}>{announcement.enabled ? "On" : "Off"}</Badge>}
      >
        {announcement.message || "No message"}
      </StatCard>
      {showDiscounts ? (
        <StatCard
          icon={TicketPercent}
          label="Discounts"
          active={active === "discounts"}
          onClick={() => onSelect("discounts")}
          aside={<Badge variant={liveDiscounts ? "ok" : "muted"}>{liveDiscounts ? `${liveDiscounts} live` : "None live"}</Badge>}
        >
          {discounts.length ? `${discounts.length} total${scheduled ? ` · ${scheduled} scheduled` : ""}` : "No discounts yet"}
        </StatCard>
      ) : null}
      <StatCard
        icon={Zap}
        label="Promote a discount"
        active={active === "flash-sale"}
        onClick={() => onSelect("flash-sale")}
        aside={<Badge variant={saleLive ? "ok" : flash_sale.active ? "warn" : "muted"}>{saleLive ? "Live" : flash_sale.active ? "Not live" : "Off"}</Badge>}
      >
        {saleSummary(featured_discount)}
      </StatCard>
    </div>
  );
}
