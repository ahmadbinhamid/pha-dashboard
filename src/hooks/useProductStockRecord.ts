import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/context";
import { getInventory, ensureInventoryRecord } from "@/lib/api/inventory";
import { getLocations } from "@/lib/api/products";
import type { InventoryRecord } from "@/types/inventory";

// The product's single Main Warehouse stock record, created on first view.
export function useProductStockRecord(productId: string, variantId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const variantParam = variantId ?? "null";

  const { data: invData, refetch } = useQuery({
    queryKey: ["inventory", "product-stock", productId, variantParam],
    queryFn: () => getInventory({ product: productId, variant: variantParam, limit: 1 }),
  });
  const record: InventoryRecord | undefined = invData?.data?.items?.[0];

  const { data: locData } = useQuery({ queryKey: ["locations"], queryFn: getLocations, enabled: !record });
  const mainWarehouse = (locData?.data ?? []).find((l) => l.is_active && l.name === "Main Warehouse");

  const ensureMutation = useMutation({
    mutationFn: () => ensureInventoryRecord({ product: productId, variant: variantId ?? null, location: mainWarehouse!._id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
      void refetch();
    },
    onError: (err: Error) => toast({ title: "Couldn't set up stock tracking", description: err.message, tone: "danger" }),
  });

  useEffect(() => {
    if (!record && mainWarehouse && !ensureMutation.isPending) ensureMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record, mainWarehouse?._id]);

  return { record, refetch };
}
