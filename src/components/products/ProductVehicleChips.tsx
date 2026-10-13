import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EMPTY_VEHICLE_SEARCH, VEHICLE_SEARCH_FIELDS } from "@/config/fitment";
import { isVehicleSearchEmpty, summarizeList, withVehicleList } from "@/lib/products/vehicleSearch";
import type { ProductVehicleSearch } from "@/types/product";

interface ProductVehicleChipsProps {
  value: ProductVehicleSearch;
  onChange: (value: ProductVehicleSearch) => void;
  onEdit: () => void;
}

// One chip per filtered field, so ten models stay one chip, not ten.
export function ProductVehicleChips({ value, onChange, onEdit }: ProductVehicleChipsProps) {
  if (isVehicleSearchEmpty(value)) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
      {VEHICLE_SEARCH_FIELDS.filter(({ key }) => value[key].length).map(({ key, label }) => {
        const full = `${label}: ${value[key].join(", ")}`;
        return (
          <div key={key} className="inline-flex h-8 items-center rounded-full border border-border">
            <Button type="button" variant="ghost" size="sm" className="h-full rounded-full pl-3 pr-1.5 text-xs" onClick={onEdit} title={full}>
              <span className="text-fg/50">{label}:</span>
              {summarizeList(value[key])}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mr-1 h-6 w-6 rounded-full"
              onClick={() => onChange(withVehicleList(value, key, []))}
              aria-label={`Clear ${label.toLowerCase()} filter`}
            >
              <X className="h-3 w-3 text-fg/45" />
            </Button>
          </div>
        );
      })}
      <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs text-fg/60" onClick={() => onChange(EMPTY_VEHICLE_SEARCH)}>
        Clear all
      </Button>
    </div>
  );
}
