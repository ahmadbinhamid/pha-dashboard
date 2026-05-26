import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/context";
import { updateVariant } from "@/lib/api/products";
import type { ProductVariant } from "@/types/product";
import { ChevronDown, ChevronUp } from "lucide-react";

interface VariantRowProps {
  variant: ProductVariant;
  productId: string;
  onUpdate: () => void;
}

export function VariantRow({ variant, productId, onUpdate }: VariantRowProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [price, setPrice] = useState(variant.price?.toString() ?? "");
  const [sku, setSku] = useState(variant.sku ?? "");

  const mutation = useMutation({
    mutationFn: (fd: FormData) => updateVariant(productId, variant._id, fd),
    onSuccess: () => {
      toast({ title: "Variant updated", tone: "success" });
      onUpdate();
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, tone: "danger" });
    },
  });

  const save = () => {
    const fd = new FormData();
    fd.append("price", price);
    fd.append("sku", sku);
    fd.append("is_active", String(variant.is_active));
    mutation.mutate(fd);
  };

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-bg-2/50"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{variant.display_name}</span>
          <Badge variant={variant.is_active ? "ok" : "muted"}>
            {variant.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-fg/60">
            ${variant.price?.toFixed(2)}
          </span>
          {variant.sku && (
            <span className="text-xs text-fg/40">{variant.sku}</span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-fg/40" />
          ) : (
            <ChevronDown className="h-4 w-4 text-fg/40" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border bg-bg-2/30 px-4 py-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-fg/60">
                Price
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-fg/60">
                SKU
              </label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Variant SKU"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={mutation.isPending}
              onClick={save}
            >
              {mutation.isPending ? "Saving..." : "Save Variant"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
