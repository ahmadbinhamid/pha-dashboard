import { Layers, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Product } from "@/types/product";

interface TagProductResultRowProps {
  product: Product;
  // Copies already queued for this product, if any.
  queuedCopies: number | null;
  onAddWhole: () => void;
  onAddOne: () => void;
  adding: boolean;
}

// A search hit with the two ways to queue it: all its stock, or one tag.
export function TagProductResultRow({ product, queuedCopies, onAddWhole, onAddOne, adding }: TagProductResultRowProps) {
  const stock = product.stock_count ?? 0;
  const atStock = queuedCopies != null && queuedCopies >= Math.max(stock, 1);

  return (
    <li className="flex items-center gap-3 px-3 py-2 hover:bg-bg-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{product.title}</p>
        <p className="mt-0.5 truncate text-xs text-fg/55">
          <span className="font-medium text-fg/75">{product.sku ?? "No stock number"}</span> · {stock} in stock
          {product.bay ? ` · Bay ${product.bay}` : ""}
          {queuedCopies != null && <span className="font-medium text-ok"> · {queuedCopies} queued</span>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 gap-1 px-2.5 text-xs"
          disabled={adding || atStock}
          onClick={onAddOne}
          title="Add to tag queue"
          aria-label={`Add one ${product.sku ?? product.title} tag to the queue`}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
        {stock > 0 && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="h-8 gap-1 px-2.5 text-xs"
            disabled={adding}
            onClick={onAddWhole}
            title="Add whole inventory to tag queue"
            aria-label={`Add all ${stock} ${product.sku ?? product.title} tags to the queue`}
          >
            <Layers className="h-3.5 w-3.5" />
            Add all ({stock})
          </Button>
        )}
      </div>
    </li>
  );
}
