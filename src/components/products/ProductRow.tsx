import { Badge } from "@/components/ui/Badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/ActionsMenu";
import type { Product } from "@/types/product";
import { formatCurrency } from "@/utils/format";
import { Package, ChevronDown, Globe, EyeOff } from "lucide-react";
import { ProductRowActionsMenu } from "@/components/products/ProductRowActionsMenu";
import { AddToCartButton } from "@/components/pos/AddToCartButton";
import { PLATFORM_LABEL } from "@/config/marketplacePlatforms";
import { STOCK_STATUS_CONFIG } from "@/config/stockStatus";

interface ProductRowProps {
  product: Product;
  listingPlatforms?: string[];
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: (published: boolean) => void;
}

export function ProductRow({
  product,
  listingPlatforms = [],
  onClick,
  onEdit,
  onDelete,
  onTogglePublish,
}: ProductRowProps) {
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

      {/* Online */}
      <td className="whitespace-nowrap px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-auto w-auto items-center gap-1 rounded-full px-0 py-0 text-fg/40 hover:bg-transparent hover:text-fg/40 data-[state=open]:bg-transparent data-[state=open]:text-fg/40">
            <Badge variant={product.is_published_online ? "ok" : "muted"} className="cursor-pointer">
              {product.is_published_online ? "Published" : "Hidden"}
              <ChevronDown className="h-3 w-3" />
            </Badge>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => onTogglePublish(true)}>
              <Globe className="h-3.5 w-3.5 text-fg/50" />
              Publish
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onTogglePublish(false)}>
              <EyeOff className="h-3.5 w-3.5 text-fg/50" />
              Hide
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>

      {/* Stock */}
      <td className="whitespace-nowrap px-4 py-3">
        <Badge variant={STOCK_STATUS_CONFIG[product.stock_status]?.variant ?? "muted"}>
          {STOCK_STATUS_CONFIG[product.stock_status]?.label ?? product.stock_status}
        </Badge>
      </td>

      {/* Channels */}
      <td className="whitespace-nowrap px-4 py-3">
        {listingPlatforms.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {listingPlatforms.map((platform) => (
              <Badge key={platform} variant="ok">
                {PLATFORM_LABEL[platform] ?? platform}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-fg/35">—</span>
        )}
      </td>

      {/* Price */}
      <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-sm">
        {formatCurrency(product.price)}
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
        <div className="flex justify-end gap-1">
          <AddToCartButton product={product} display="icon" />
          <ProductRowActionsMenu onEdit={onEdit} onDelete={onDelete} />
        </div>
      </td>
    </tr>
  );
}
