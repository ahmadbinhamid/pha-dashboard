import { useState } from "react";
import { Expand } from "lucide-react";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/utils/cn";
import { ImageViewerModal } from "@/components/media/ImageViewerModal";
import type { Attachment } from "@/types/product";

interface ProductLivePreviewCardProps {
  title: string;
  images?: Attachment[];
  price: string;
  sku?: string | null;
  skuPending?: boolean;
  stockCount?: number | null;
}

// Read-only reflection of the form's current values — lets the user see
// roughly what the product will look like before saving. Clicking the
// cover opens a full-screen viewer (zoom + next/prev) over every image.
export function ProductLivePreviewCard({
  title,
  images = [],
  price,
  sku,
  skuPending,
  stockCount,
}: ProductLivePreviewCardProps) {
  const priceNumber = Number(price) || 0;
  const cover = images[0];
  const [viewerOpen, setViewerOpen] = useState(false);

  return (
    <div className="rounded-md bg-card p-4 shadow-card ring-1 ring-inset ring-border">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-fg/40">Live Preview</p>

      <div
        className={cn(
          "group relative mt-3 flex aspect-square items-center justify-center overflow-hidden rounded-md bg-bg-2",
          cover && "cursor-zoom-in",
        )}
        onClick={() => cover && setViewerOpen(true)}
        role={cover ? "button" : undefined}
        tabIndex={cover ? 0 : undefined}
        onKeyDown={(e) => {
          if (cover && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setViewerOpen(true);
          }
        }}
        aria-label={cover ? "View full image" : undefined}
      >
        {cover ? (
          <>
            <img src={cover.url} alt={title || "Product preview"} className="h-full w-full object-contain p-2" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
              <Expand className="h-5 w-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </>
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
        <span className="text-xs text-fg/45">{stockCount ?? 0} in stock</span>
      </div>

      <ImageViewerModal images={images} open={viewerOpen} onOpenChange={setViewerOpen} initialIndex={0} />
    </div>
  );
}
