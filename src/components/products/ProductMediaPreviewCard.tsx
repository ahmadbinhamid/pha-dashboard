import { Card } from "@/components/ui/Card";
import { ProductImages } from "@/components/media/ProductImages";
import { formatCurrency } from "@/utils/format";
import type { Attachment } from "@/types/product";

export const PRODUCT_MEDIA_ANCHOR = "product-media";

interface ProductMediaPreviewCardProps {
  images: Attachment[];
  onImagesChange: (images: Attachment[]) => void;
  onUploadingChange: (uploading: boolean) => void;
  title: string;
  sku: string;
  price: string;
  stockCount: number | null | undefined;
}

// Image editor and live preview in one card, so the cover is never shown twice.
export function ProductMediaPreviewCard({
  images,
  onImagesChange,
  onUploadingChange,
  title,
  sku,
  price,
  stockCount,
}: ProductMediaPreviewCardProps) {
  return (
    <Card id={PRODUCT_MEDIA_ANCHOR} className="scroll-mt-40">
      <div className="flex items-center gap-2 px-4 pt-3">
        <h4 className="text-sm font-semibold text-fg">Media &amp; preview</h4>
        <span className="ml-auto text-xs text-fg/45">
          {images.length} {images.length === 1 ? "image" : "images"}
        </span>
      </div>
      <div className="p-3">
        <ProductImages images={images} onChange={onImagesChange} onUploadingChange={onUploadingChange} />
      </div>
      <div className="border-t border-border px-4 pb-4 pt-3">
        <p className="line-clamp-2 text-sm font-medium text-fg">{title || "Untitled product"}</p>
        <p className="mt-1 font-mono text-xs text-fg/45">{sku || "SKU not assigned"}</p>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-lg font-semibold text-fg">{formatCurrency(Number(price) || 0)}</span>
          {stockCount != null && <span className="text-xs text-fg/45">{stockCount} in stock</span>}
        </div>
      </div>
    </Card>
  );
}
