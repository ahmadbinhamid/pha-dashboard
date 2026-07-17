import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getLocations } from "@/lib/api/products";
import type { StockEntry } from "@/types/product";
import { MapPin, Plus, X } from "lucide-react";

interface CreateStockSectionProps {
  entries: StockEntry[];
  onChange: (entries: StockEntry[]) => void;
}

export function CreateStockSection({ entries, onChange }: CreateStockSectionProps) {
  const [addingLocation, setAddingLocation] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [qty, setQty] = useState("");

  const { data: locData } = useQuery({
    queryKey: ["locations"],
    queryFn: getLocations,
  });
  const allLocations = locData?.data ?? [];
  const usedIds = new Set(entries.map((e) => e.location_id));
  const availableLocations = allLocations.filter(
    (l) => l.is_active && l.name === "Main Warehouse" && !usedIds.has(l._id),
  );

  useEffect(() => {
    if (availableLocations.length > 0 && !selectedLocation) {
      setSelectedLocation(availableLocations[0]._id);
    }
  }, [availableLocations.length]);

  const handleAdd = () => {
    const loc = allLocations.find((l) => l._id === selectedLocation);
    if (!loc) return;
    onChange([
      ...entries,
      { location_id: loc._id, location_name: loc.name, qty: Number(qty) || 0 },
    ]);
    setAddingLocation(false);
    setSelectedLocation("");
    setQty("");
  };

  const handleRemove = (locationId: string) => {
    onChange(entries.filter((e) => e.location_id !== locationId));
  };

  const canAdd = selectedLocation && qty !== "" && Number(qty) >= 0;

  const resetForm = () => {
    setAddingLocation(false);
    setSelectedLocation("");
    setQty("");
  };

  if (entries.length === 0 && !addingLocation) {
    return (
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
    );
  }

  return (
    <div className="space-y-1.5">
      {entries.map((entry) => (
        <div
          key={entry.location_id}
          className="flex items-center justify-between rounded-xs border border-border bg-bg px-3 py-2.5"
        >
          <div>
            <span className="text-sm font-medium">{entry.location_name}</span>
            <span className="ml-2 text-sm text-fg/55">{entry.qty} in stock</span>
          </div>
          <button
            type="button"
            onClick={() => handleRemove(entry.location_id)}
            className="text-fg/35 transition hover:text-danger"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}

      {addingLocation ? (
        <div className="rounded-xs border border-border bg-bg-2/40 p-3 space-y-2">
          <p className="text-xs font-medium text-fg/60">Add Location</p>
          <div className="flex gap-2">
            <div className="flex flex-1 items-center rounded-xs border border-border bg-bg px-3 text-sm text-fg/70">
              Main Warehouse
            </div>
            <Input
              type="number"
              min="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Qty"
              className="w-24"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!canAdd}
              onClick={handleAdd}
              className="flex-1"
            >
              Add
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      ) : availableLocations.length > 0 ? (
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
  );
}
