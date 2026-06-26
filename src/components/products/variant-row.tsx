import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProductImages } from "@/components/media/product-images";
import { SetStockDialogFull } from "@/components/inventory/set-stock-dialog";
import { useToast } from "@/context";
import { updateVariant } from "@/lib/api/products";
import { getInventory, ensureInventoryRecord } from "@/lib/api/inventory";
import { getLocations } from "@/lib/api/products";
import type { Attachment, ProductVariant } from "@/types/product";
import type { InventoryRecord } from "@/types/inventory";
import { ChevronDown, ImageIcon, MapPin, Plus } from "lucide-react";
import { cn } from "@/utils/cn";

interface VariantRowProps {
  variant: ProductVariant;
  productId: string;
  onUpdate: () => void;
}

function MiniToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        checked ? "bg-accent" : "bg-border",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-4.5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function VariantRow({ variant, productId, onUpdate }: VariantRowProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [price, setPrice] = useState(variant.price?.toString() ?? "");
  const [costPrice, setCostPrice] = useState(variant.cost_price?.toString() ?? "");
  const [sku, setSku] = useState(variant.sku ?? "");
  const [barcode, setBarcode] = useState(variant.barcode ?? "");
  const [isActive, setIsActive] = useState(variant.is_active);
  const [images, setImages] = useState<Attachment[]>(variant.attachments ?? []);
  const [setStockTarget, setSetStockTarget] = useState<InventoryRecord | null>(null);
  const [addingLocation, setAddingLocation] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("");

  const { data: invData, refetch: refetchInv } = useQuery({
    queryKey: ["inventory", "variant", variant._id],
    queryFn: () =>
      getInventory({ product: productId, variant: variant._id, limit: 100 }),
  });
  const inventoryRecords: InventoryRecord[] = invData?.data?.items ?? [];

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

  const mutation = useMutation({
    mutationFn: (fd: FormData) => updateVariant(productId, variant._id, fd),
    onSuccess: () => {
      toast({ title: "Variant saved", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      onUpdate();
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, tone: "danger" });
    },
  });

  const ensureMutation = useMutation({
    mutationFn: (locationId: string) =>
      ensureInventoryRecord({ product: productId, variant: variant._id, location: locationId }),
    onSuccess: (res) => {
      refetchInv();
      setAddingLocation(false);
      setSelectedLocation("");
      if (res.data) setSetStockTarget(res.data as InventoryRecord);
    },
    onError: (err: Error) => {
      toast({ title: "Failed", description: err.message, tone: "danger" });
    },
  });

  const save = () => {
    const fd = new FormData();
    fd.append("price", price);
    fd.append("cost_price", costPrice);
    fd.append("sku", sku);
    fd.append("barcode", barcode);
    fd.append("is_active", String(isActive));
    fd.append(
      "attachments",
      JSON.stringify(images.map((img) => img._id || img.id).filter(Boolean)),
    );
    mutation.mutate(fd);
  };

  const handleActiveToggle = (val: boolean) => {
    setIsActive(val);
    const fd = new FormData();
    fd.append("is_active", String(val));
    fd.append("price", price);
    mutation.mutate(fd);
  };

  const coverImage = images[0] ?? variant.attachments?.[0];

  return (
    <div className="border-b border-border last:border-0">
      {/* Collapsed row */}
      <div
        className="flex items-center gap-3 px-4 py-3 transition hover:bg-bg-2/50"
      >
        {/* Thumbnail */}
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xs border border-border bg-bg-2">
          {coverImage?.url ? (
            <img
              src={coverImage.url}
              alt={coverImage.original_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-fg/25">
              <ImageIcon className="h-4 w-4" />
            </div>
          )}
        </div>

        <Badge variant="default">{variant.display_name}</Badge>

        {/* Price inline input */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-fg/45">
            Price
          </span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="h-7 w-24 text-sm"
          />
        </div>

        <div
          className="ml-auto flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-fg/45">
            Active
          </span>
          <MiniToggle checked={isActive} onChange={handleActiveToggle} />
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 rounded-xs p-1 text-fg/40 hover:text-fg"
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
          />
        </button>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="space-y-4 border-t border-border bg-bg-2/30 px-4 py-4">
          {/* Images */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg/50">
              Images
            </div>
            <ProductImages images={images} onChange={setImages} />
          </div>

          {/* Fields */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg/65">
                Cost Price
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg/65">
                SKU
              </label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="SKU-001"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg/65">
                Barcode
              </label>
              <Input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="EAN / UPC"
              />
            </div>
          </div>

          {/* Set Stock inline */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg/50">
              Set Stock
            </div>
            {inventoryRecords.length === 0 && !addingLocation ? (
              <div className="flex flex-col items-center gap-2 rounded-xs border border-dashed border-border py-4 text-center">
                <MapPin className="h-5 w-5 text-fg/30" />
                <p className="text-xs text-fg/45">No stock entries</p>
                <button
                  type="button"
                  onClick={() => setAddingLocation(true)}
                  className="text-xs text-accent hover:underline"
                >
                  + Add Location
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {inventoryRecords.map((rec) => (
                  <div
                    key={rec._id}
                    className="flex items-center justify-between rounded-xs border border-border bg-bg px-3 py-2"
                  >
                    <div className="text-sm">
                      <span className="font-medium">{rec.location?.name}</span>
                      <span className="ml-2 text-fg/55">
                        {rec.stock_count} in stock
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSetStockTarget(rec)}
                      className="text-xs text-accent hover:underline"
                    >
                      Set Stock
                    </button>
                  </div>
                ))}
                {availableLocations.length > 0 && !addingLocation && (
                  <button
                    type="button"
                    onClick={() => setAddingLocation(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xs border border-dashed border-border py-1.5 text-xs text-fg/50 hover:border-fg/25 hover:text-fg/80 transition"
                  >
                    <Plus className="h-3 w-3" />
                    Add Location
                  </button>
                )}
              </div>
            )}

            {addingLocation && (
              <div className="mt-2 flex items-center gap-2">
                <NativeSelect
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="flex-1"
                >
                  <option value="">Select location…</option>
                  {availableLocations.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.name}
                    </option>
                  ))}
                </NativeSelect>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!selectedLocation || ensureMutation.isPending}
                  onClick={() => ensureMutation.mutate(selectedLocation)}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setAddingLocation(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={mutation.isPending}
              onClick={save}
              className="gap-1.5"
            >
              {mutation.isPending ? "Saving…" : "Save Variant"}
            </Button>
          </div>
        </div>
      )}

      {setStockTarget && (
        <SetStockDialogFull
          item={setStockTarget}
          onClose={() => {
            setSetStockTarget(null);
            refetchInv();
          }}
        />
      )}
    </div>
  );
}
