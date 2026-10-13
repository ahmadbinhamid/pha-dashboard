import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EMPTY_VEHICLE_SEARCH, VEHICLE_SEARCH_FIELDS } from "@/config/fitment";
import { isVehicleSearchEmpty, withVehicleList } from "@/lib/products/vehicleSearch";
import type { ProductVehicleSearch } from "@/types/product";

interface ProductVehicleChipsProps {
  value: ProductVehicleSearch;
  onChange: (value: ProductVehicleSearch) => void;
}

// Applied vehicle filters, one removable chip each, on their own row.
export function ProductVehicleChips({ value, onChange }: ProductVehicleChipsProps) {
  if (isVehicleSearchEmpty(value)) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
      {VEHICLE_SEARCH_FIELDS.flatMap(({ key, label }) =>
        value[key].map((item) => (
          <Button
            key={`${key}-${item}`}
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            onClick={() => onChange(withVehicleList(value, key, value[key].filter((v) => v !== item)))}
            aria-label={`Remove ${label} ${item}`}
          >
            <span className="text-fg/50">{label}:</span>
            {item}
            <X className="h-3 w-3 text-fg/45" />
          </Button>
        )),
      )}
      <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs text-fg/60" onClick={() => onChange(EMPTY_VEHICLE_SEARCH)}>
        Clear all
      </Button>
    </div>
  );
}
