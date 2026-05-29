import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  ActionsMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/actions-menu";
import type { Product } from "@/types/product";
import { Package, Pencil, Trash2 } from "lucide-react";

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

function ActionsMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <ActionsMenuTrigger />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil className="h-3.5 w-3.5 text-fg/50" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ProductRowProps {
  product: Product;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ProductRow({ product, onClick, onEdit, onDelete }: ProductRowProps) {
  const coverImage = product.attachments?.[0];

  return (
    <tr
      onClick={onClick}
      className="group cursor-pointer transition hover:bg-bg-2/50"
    >
      {/* Product — absorbs all spare width; max-w-0 makes truncate work in tables */}
      <td className="w-full max-w-0 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xs border border-border bg-bg-2">
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
            <div className="mt-0.5 flex items-center gap-2">
              {product.sku ? (
                <span className="truncate text-xs text-fg/45">
                  {product.sku}
                </span>
              ) : (
                <span className="text-xs text-fg/30 italic">No SKU</span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Status */}
      <td className="whitespace-nowrap px-4 py-3">
        <Badge variant={product.status === "active" ? "ok" : "muted"}>
          {product.status === "active" ? "Active" : "Draft"}
        </Badge>
      </td>

      {/* Type */}
      <td className="whitespace-nowrap px-4 py-3">
        <Badge variant="default">
          {product.type === "digital" ? "Digital" : "Physical"}
        </Badge>
      </td>

      {/* Price */}
      <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-sm">
        £{product.price.toFixed(2)}
      </td>

      {/* eBay */}
      <td className="whitespace-nowrap px-4 py-3">
        <EbaySyncBadge status={product.ebay_sync_status} />
      </td>

      {/* Created */}
      <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-fg/45">
        {new Date(product.created_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </td>

      {/* Actions */}
      <td className="w-px whitespace-nowrap px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end">
          <ActionsMenu onEdit={onEdit} onDelete={onDelete} />
        </div>
      </td>
    </tr>
  );
}
