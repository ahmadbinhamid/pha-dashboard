import { Badge } from "@/components/ui/Badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/ActionsMenu";
import { ProductRowActionsMenu } from "@/components/products/ProductRowActionsMenu";
import { AddToCartButton } from "@/components/pos/AddToCartButton";
import type { Product } from "@/types/product";
import { formatCurrency } from "@/utils/format";
import { Package, ChevronDown, Globe, EyeOff } from "lucide-react";
import { STOCK_STATUS_CONFIG } from "@/config/stockStatus";
import { cn } from "@/utils/cn";

const STOCK_TEXT_CLASS: Record<string, string> = {
  ok: "text-tag-success-fg",
  warn: "text-tag-warn-fg",
  danger: "text-tag-danger-fg",
};

interface ProductCardProps {
  product: Product;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: (published: boolean) => void;
}

function StatusDot({ on }: { on: boolean }) {
  return <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", on ? "bg-accent" : "bg-fg/30")} />;
}

export function ProductCard({
  product,
  onClick,
  onEdit,
  onDelete,
  onTogglePublish,
}: ProductCardProps) {
  const coverImage = product.attachments?.[0];
  const stock = STOCK_STATUS_CONFIG[product.stock_status];
  const createdAt = new Date(product.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div
      onClick={onClick}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-md bg-card shadow-card ring-1 ring-inset ring-border transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
    >
      {/* Image */}
      <div className="relative aspect-square shrink-0 overflow-hidden rounded-t-md border border-border bg-bg-2">
        {coverImage?.url ? (
          <img
            src={coverImage.url}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Package className="h-10 w-10 text-fg/20" />
          </div>
        )}

        {/* Status badge */}
        <div className="absolute right-2 top-2">
          <Badge
            variant="outline"
            className="gap-1.5 border-none bg-card/95 shadow-card ring-1 ring-inset ring-border backdrop-blur-sm"
          >
            <StatusDot on={product.status === "active"} />
            {product.status === "active" ? "Active" : "Draft"}
          </Badge>
        </div>

        {/* Add to cart on hover */}
        <div
          className="absolute left-2 top-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <AddToCartButton
            product={product}
            display="icon"
            className="bg-card/90 shadow-card ring-1 ring-inset ring-border backdrop-blur-sm hover:bg-card"
          />
        </div>
      </div>

      {/* Badge row — straddles the image / body boundary */}
      <div className="relative z-10 -mt-4 flex items-center justify-between gap-2 px-3.5">
        {product.has_variants ? (
          <Badge variant="outline" className="border-none bg-card shadow-card ring-1 ring-inset ring-border">
            Has Variants
          </Badge>
        ) : (
          <span />
        )}

        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-auto w-auto items-center rounded-full px-0 py-0 text-fg/40 hover:bg-transparent hover:text-fg/40 data-[state=open]:bg-transparent data-[state=open]:text-fg/40">
              <Badge
                variant="outline"
                className="cursor-pointer gap-1.5 border-none bg-card shadow-card ring-1 ring-inset ring-border"
              >
                <StatusDot on={product.is_published_online} />
                {product.is_published_online ? "Published" : "Hidden"}
                <ChevronDown className="h-3 w-3" />
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col px-3.5 pb-3.5 pt-3">
        <p className="text-[11px] text-fg/40">{createdAt}</p>

        <div className="mt-1 flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-bold uppercase leading-snug tracking-tight text-fg">
            {product.title}
          </p>
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <ProductRowActionsMenu onEdit={onEdit} onDelete={onDelete} />
          </div>
        </div>

        <p className={cn("mt-1 text-xs font-semibold", STOCK_TEXT_CLASS[stock?.variant ?? ""] ?? "text-fg/50")}>
          {stock?.label ?? product.stock_status}
        </p>

        <div className="mt-auto pt-2.5">
          <div className="border-t border-border pt-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-fg/40">Price</p>
            <p className="mt-0.5 text-lg font-bold text-fg">{formatCurrency(product.price)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
