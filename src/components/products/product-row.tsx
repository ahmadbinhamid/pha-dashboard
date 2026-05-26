import { Badge } from "@/components/ui/badge";
import type { Product } from "@/types/product";
import { Package } from "lucide-react";

const EBAY_BADGE_MAP: Record<
  string,
  { label: string; variant: "ok" | "warn" | "danger" | "muted" }
> = {
  synced: { label: "Synced", variant: "ok" },
  pending: { label: "Pending", variant: "warn" },
  error: { label: "Error", variant: "danger" },
  not_listed: { label: "Not listed", variant: "muted" },
};

export function EbaySyncBadge({
  status,
}: {
  status: Product["ebay_sync_status"];
}) {
  const { label, variant } =
    EBAY_BADGE_MAP[status] ?? EBAY_BADGE_MAP.not_listed;
  return <Badge variant={variant}>{label}</Badge>;
}

interface ProductRowProps {
  product: Product;
  onClick: () => void;
}

export function ProductRow({ product, onClick }: ProductRowProps) {
  const coverImage = product.attachments?.[0];

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer transition hover:bg-bg-2/50"
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-bg-2">
            {coverImage?.url ? (
              <img
                src={coverImage.url}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="h-5 w-5 text-fg/25" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate font-medium text-fg">{product.title}</div>
            {product.sku && (
              <div className="mt-0.5 truncate text-xs text-fg/50">
                SKU: {product.sku}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant={product.status === 1 ? "ok" : "muted"}>
          {product.status === 1 ? "Active" : "Draft"}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <Badge variant="default">
          {product.type === 2 ? "Digital" : "Physical"}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right font-medium tabular-nums">
        ${product.price.toFixed(2)}
      </td>
      <td className="px-4 py-3">
        <EbaySyncBadge status={product.ebay_sync_status} />
      </td>
      <td className="px-5 py-3 text-right text-xs text-fg/50">
        {new Date(product.created_at).toLocaleDateString()}
      </td>
    </tr>
  );
}
