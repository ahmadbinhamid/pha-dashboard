import { Printer, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import Link from "@/components/ui/Link";
import { TableCell, TableRow } from "@/components/ui/Table";
import { QuantityStepper } from "@/components/pos/QuantityStepper";
import { MAX_TAG_COPIES } from "@/config/productTag";
import { cn } from "@/utils/cn";
import type { TagQueueItem } from "@/types/tags";

interface TagQueueRowProps {
  item: TagQueueItem;
  selected: boolean;
  onSelect: () => void;
  onCopiesChange: (copies: number) => void;
  onPrint: () => void;
  onRemove: () => void;
  disabled?: boolean;
}

// One queued product; click to preview, stepper capped at its stock.
export function TagQueueRow({ item, selected, onSelect, onCopiesChange, onPrint, onRemove, disabled }: TagQueueRowProps) {
  const max = Math.min(Math.max(item.stock_count, 1), MAX_TAG_COPIES);

  return (
    <TableRow onClick={onSelect} className={cn("cursor-pointer", selected && "bg-accent/5 hover:bg-accent/5")}>
      <TableCell className="max-w-0 w-full">
        <Link
          href={`/products/${item.product.slug}/edit`}
          onClick={(e) => e.stopPropagation()}
          className="block truncate text-sm font-medium text-fg hover:underline"
        >
          {item.product.title}
        </Link>
        <div className="mt-1 flex items-center gap-1.5">
          <Badge variant="outline">{item.product.sku ?? "No stock number"}</Badge>
          {item.product.bay ? (
            <span className="rounded-sm bg-fg px-1.5 py-0.5 text-2xs font-bold uppercase text-bg">Bay {item.product.bay}</span>
          ) : (
            <span className="text-xs text-warn">No bay</span>
          )}
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm tabular-nums text-fg/70">{item.stock_count}</TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <QuantityStepper value={item.copies} onChange={onCopiesChange} max={max} editable disabled={disabled} />
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-fg/60" disabled={disabled} onClick={onPrint} aria-label="Print these tags">
            <Printer className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-fg/50 hover:text-danger" disabled={disabled} onClick={onRemove} aria-label="Remove from queue">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
