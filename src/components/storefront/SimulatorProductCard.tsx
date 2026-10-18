import { useEffect, useState } from "react";
import { Check, Package } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Image } from "@/components/ui/Image";
import { SaleBadge } from "@/components/storefront/SaleBadge";
import { salePrice } from "@/lib/storefront/salePricing";
import type { Product } from "@/types/product";
import type { PromotedSale } from "@/types/storefront";
import { formatCurrency } from "@/utils/format";

const ADDED_FEEDBACK_MS = 1200;

interface SimulatorProductCardProps {
  product: Product;
  // The running sale, only when it covers this product.
  sale: PromotedSale | null;
  onAdd: () => void;
}

export function SimulatorProductCard({ product, sale, onAdd }: SimulatorProductCardProps) {
  const [added, setAdded] = useState(false);
  const cover = product.attachments?.find((a) => a.type === "image") ?? product.attachments?.[0];
  const discounted = sale ? salePrice(product.price, sale) : null;

  useEffect(() => {
    if (!added) return;
    const id = window.setTimeout(() => setAdded(false), ADDED_FEEDBACK_MS);
    return () => window.clearTimeout(id);
  }, [added]);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-square bg-bg-2">
        {cover?.url ? (
          <Image src={cover.url} alt={product.title} fill />
        ) : (
          <div className="flex h-full items-center justify-center text-fg/30">
            <Package className="h-8 w-8" />
          </div>
        )}
        {sale ? (
          <SaleBadge theme={sale.badge_theme} bgColor={sale.badge_bg_color} textColor={sale.badge_text_color} className="absolute top-2 left-2">
            {sale.discount_type === "percent" ? `-${sale.discount_value}%` : "Sale"}
          </SaleBadge>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2 text-xs font-medium text-fg">{product.title}</p>
        <div className="mt-auto flex items-baseline gap-1.5">
          <span className={discounted !== null ? "text-sm font-bold text-danger" : "text-sm font-bold text-fg"}>
            {formatCurrency(discounted ?? product.price)}
          </span>
          {discounted !== null ? <span className="text-2xs text-fg/45 line-through">{formatCurrency(product.price)}</span> : null}
        </div>
        {sale && discounted === null ? (
          <p className="text-3xs font-semibold text-danger uppercase">{sale.code ? `Code ${sale.code} at checkout` : "Discount at checkout"}</p>
        ) : null}
        <Button
          type="button"
          size="sm"
          className="mt-1 h-8 w-full text-xs"
          onClick={() => {
            setAdded(true);
            onAdd();
          }}
        >
          {added ? <Check className="h-3.5 w-3.5" /> : null}
          {added ? "Added" : "Add to Cart"}
        </Button>
      </div>
    </div>
  );
}
