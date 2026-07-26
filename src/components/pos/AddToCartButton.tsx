import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { NativeSelect } from "@/components/ui/Select";
import { useCart } from "@/context/cart";
import { getVariants } from "@/lib/api/products";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { Product } from "@/types/product";

interface AddToCartButtonProps {
  product: Product;
  // "icon" for dense contexts (table rows); "labeled" for a full button
  // (product detail page); "icon-solid" for a prominent circular action in
  // a shopping list (Add Products step) — same icon-only content as "icon"
  // but sized and colored to read as the row's primary action, not a minor one.
  display?: "icon" | "labeled" | "icon-solid";
  className?: string;
}

function cartKey(productId: string, variantId: string | null) {
  return `${productId}:${variantId ?? "base"}`;
}

// Handles both add paths: a plain product adds straight to the cart on
// click; a has_variants product opens a popover to pick which variant (and
// quantity) first, since a variant is what's actually sellable, not the
// parent product itself.
export function AddToCartButton({ product, display = "icon", className }: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [open, setOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const isBaseOutOfStock =
    !product.has_variants && product.stock_control && (product.stock_count ?? 0) <= 0;

  const { data, isLoading } = useQuery({
    queryKey: ["product-variants", product._id],
    queryFn: () => getVariants(product._id),
    enabled: open && product.has_variants,
  });
  const variants = (data?.data ?? []).filter((v) => v.is_active);

  function resetPicker() {
    setSelectedVariantId("");
    setQuantity(1);
  }

  function addBaseProduct() {
    addItem({
      key: cartKey(product._id, null),
      product_id: product._id,
      variant_id: null,
      name: product.title,
      sku: product.sku,
      image_url: product.attachments?.[0]?.url ?? null,
      unit_price: product.price,
      shipping_cost: product.shipping_cost ?? 0,
      max_quantity: product.stock_control ? product.stock_count : null,
    });
  }

  function addSelectedVariant() {
    const variant = variants.find((v) => v._id === selectedVariantId);
    if (!variant) return;
    addItem({
      key: cartKey(product._id, variant._id),
      product_id: product._id,
      variant_id: variant._id,
      name: `${product.title} — ${variant.display_name}`,
      sku: variant.sku,
      image_url: variant.attachments?.[0]?.url ?? product.attachments?.[0]?.url ?? null,
      unit_price: variant.price,
      // No per-variant shipping rate — always the parent product's.
      shipping_cost: product.shipping_cost ?? 0,
      quantity,
      // Variant-level stock isn't exposed by the list-variants endpoint —
      // the backend re-validates real availability at order-creation time.
      max_quantity: null,
    });
    setOpen(false);
    resetPicker();
  }

  const triggerContent = (
    <>
      <ShoppingCart className={display === "icon" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {display === "labeled" && "Add to Cart"}
    </>
  );

  const triggerVariant = display === "labeled" ? "secondary" : display === "icon-solid" ? "primary" : "ghost";
  const triggerSize = display === "labeled" ? "sm" : "icon";
  const triggerClassName = cn(
    display === "icon-solid" ? "h-10 w-10 rounded-full p-0" : display === "icon" ? "h-7 w-7 p-0" : "gap-1.5",
    className,
  );

  if (!product.has_variants) {
    return (
      <Button
        type="button"
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        disabled={isBaseOutOfStock}
        title={isBaseOutOfStock ? "Out of stock" : "Add to cart"}
        onClick={(e) => {
          e.stopPropagation();
          addBaseProduct();
        }}
      >
        {triggerContent}
      </Button>
    );
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetPicker();
      }}
    >
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant={triggerVariant}
          size={triggerSize}
          className={triggerClassName}
          title="Add to cart"
          onClick={(e) => e.stopPropagation()}
        >
          {triggerContent}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="end"
          onClick={(e) => e.stopPropagation()}
          className="z-50 w-72 rounded-xs border border-border bg-bg p-3 shadow-lg"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg/45">Select a variant</p>
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-fg/40" />
            </div>
          ) : variants.length === 0 ? (
            <p className="py-3 text-center text-xs text-fg/50">No active variants found.</p>
          ) : (
            <div className="space-y-2">
              <NativeSelect value={selectedVariantId} onChange={(e) => setSelectedVariantId(e.target.value)}>
                <option value="">Choose a variant…</option>
                {variants.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.display_name} — {formatCurrency(v.price)}
                  </option>
                ))}
              </NativeSelect>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
              />
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="w-full"
                disabled={!selectedVariantId}
                onClick={addSelectedVariant}
              >
                Add to Cart
              </Button>
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
