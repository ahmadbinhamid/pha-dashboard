import { formatCurrency } from "@/utils/format";

interface ProductLivePreviewCardProps {
  title: string;
  image?: string;
  price: string;
  sku?: string | null;
  skuPending?: boolean;
  stockControl: boolean;
  stockCount?: number | null;
}

// Read-only reflection of the form's current values — lets the user see
// roughly what the product will look like before saving.
export function ProductLivePreviewCard({
  title,
  image,
  price,
  sku,
  skuPending,
  stockControl,
  stockCount,
}: ProductLivePreviewCardProps) {
  const priceNumber = Number(price) || 0;

  return (
    <div className="rounded-md bg-card p-4 shadow-card ring-1 ring-inset ring-border">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-fg/40">Live Preview</p>

      <div className="mt-3 flex aspect-square items-center justify-center overflow-hidden rounded-md bg-bg-2">
        {image ? (
          <img src={image} alt={title || "Product preview"} className="h-full w-full object-contain p-2" />
        ) : (
          <span className="text-xs text-fg/35">No image yet</span>
        )}
      </div>

      <p className="mt-3 truncate text-sm font-semibold text-fg">{title.trim() || "Untitled product"}</p>
      <p className="mt-0.5 truncate text-xs text-fg/45">
        {skuPending ? "SKU · auto on save" : sku || "No SKU yet"}
      </p>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-xl font-bold text-fg">{formatCurrency(priceNumber)}</span>
        <span className="text-xs text-fg/45">
          {stockControl ? `${stockCount ?? 0} in stock` : "Stock not tracked"}
        </span>
      </div>
    </div>
  );
}
