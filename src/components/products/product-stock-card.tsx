import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { SetStockDialogFull } from "@/components/inventory/set-stock-dialog";
import { useToast } from "@/context";
import { getInventory, ensureInventoryRecord, setStock } from "@/lib/api/inventory";
import { getLocations } from "@/lib/api/products";
import type { InventoryRecord } from "@/types/inventory";
import { MapPin, Plus } from "lucide-react";

interface ProductStockCardProps {
  productId: string;
  variantId?: string;
  limit?: number;
}

export function ProductStockCard({ productId, variantId, limit }: ProductStockCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [setStockTarget, setSetStockTarget] = useState<InventoryRecord | null>(null);
  const [addingLocation, setAddingLocation] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [initialQty, setInitialQty] = useState("");

  const variantParam = variantId ?? "null";

  const { data: invData, refetch: refetchInv } = useQuery({
    queryKey: ["inventory", "product-stock", productId, variantParam],
    queryFn: () =>
      getInventory({ product: productId, variant: variantParam, limit: 100 }),
  });
  const inventoryRecords: InventoryRecord[] = invData?.data?.items ?? [];
  const displayRecords = limit ? inventoryRecords.slice(0, limit) : inventoryRecords;

  const { data: locData } = useQuery({
    queryKey: ["locations"],
    queryFn: getLocations,
    enabled: addingLocation,
  });
  const allLocations = locData?.data ?? [];
  const usedLocationIds = new Set(inventoryRecords.map((r) => r.location?._id));
  const availableLocations = allLocations.filter(
    (l) => l.is_active && !usedLocationIds.has(l._id) && l.name === "Main Warehouse",
  );

  useEffect(() => {
    if (availableLocations.length > 0 && !selectedLocation) {
      setSelectedLocation(availableLocations[0]._id);
    }
  }, [availableLocations.length]);

  const ensureMutation = useMutation({
    mutationFn: async (locationId: string) => {
      const res = await ensureInventoryRecord({
        product: productId,
        variant: variantId ?? null,
        location: locationId,
      });
      const record = res.data as InventoryRecord;
      // Set the initial qty immediately if provided
      // Always set stock so a history entry is written, even for qty 0
      await setStock(record._id, { stock_count: Number(initialQty) });
      return record;
    },
    onSuccess: () => {
      toast({ title: "Location added", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      refetchInv();
      setAddingLocation(false);
      setSelectedLocation("");
      setInitialQty("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to add location", description: err.message, tone: "danger" });
    },
  });

  const canAdd = selectedLocation && initialQty !== "" && Number(initialQty) >= 0;

  const resetAddForm = () => {
    setAddingLocation(false);
    setSelectedLocation("");
    setInitialQty("");
  };

  if (displayRecords.length === 0 && !addingLocation) {
    return (
      <>
        <div className="flex flex-col items-center gap-2 rounded-xs border border-dashed border-border py-6 text-center">
          <MapPin className="h-6 w-6 text-fg/30" />
          <p className="text-sm text-fg/45">No stock entries</p>
          <button
            type="button"
            onClick={() => setAddingLocation(true)}
            className="flex items-center gap-1.5 rounded-xs border border-dashed border-border px-3 py-1.5 text-sm text-fg/55 transition hover:border-fg/25 hover:text-fg/80"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Location
          </button>
        </div>

        {setStockTarget && (
          <SetStockDialogFull
            item={setStockTarget}
            onClose={() => { setSetStockTarget(null); refetchInv(); }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="space-y-1.5">
        {displayRecords.map((rec) => (
          <div
            key={rec._id}
            className="flex items-center justify-between rounded-xs border border-border bg-bg px-3 py-2.5"
          >
            <div>
              <span className="text-sm font-medium">{rec.location?.name}</span>
              <span className="ml-2 text-sm text-fg/55">
                {rec.stock_count} in stock
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSetStockTarget(rec)}
              className="text-xs font-medium text-accent hover:underline"
            >
              Set Stock
            </button>
          </div>
        ))}

        {/* Add Location inline form */}
        {addingLocation && (!limit || inventoryRecords.length < limit) ? (
          <div className="rounded-xs border border-border bg-bg-2/40 p-3 space-y-2">
            <p className="text-xs font-medium text-fg/60">Add Location</p>
            <div className="flex gap-2">
              <NativeSelect
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="flex-1"
              >
                <option value="">Select location… *</option>
                {availableLocations.map((l) => (
                  <option key={l._id} value={l._id}>{l.name}</option>
                ))}
              </NativeSelect>
              <Input
                type="number"
                min="0"
                value={initialQty}
                onChange={(e) => setInitialQty(e.target.value)}
                placeholder="Qty *"
                className="w-24"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!canAdd || ensureMutation.isPending}
                onClick={() => ensureMutation.mutate(selectedLocation)}
                className="flex-1"
              >
                {ensureMutation.isPending ? "Adding…" : "Add"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={resetAddForm}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : availableLocations.length > 0 && (!limit || inventoryRecords.length < limit) ? (
          <button
            type="button"
            onClick={() => setAddingLocation(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xs border border-dashed border-border py-2 text-sm text-fg/50 transition hover:border-fg/25 hover:text-fg/80"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Location
          </button>
        ) : null}
      </div>

      {setStockTarget && (
        <SetStockDialogFull
          item={setStockTarget}
          onClose={() => { setSetStockTarget(null); refetchInv(); }}
        />
      )}
    </>
  );
}
