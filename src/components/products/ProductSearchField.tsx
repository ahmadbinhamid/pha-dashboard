import { useRef, useState } from "react";
import { Car, Search, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/Popover";
import { FitmentRow } from "@/components/shared/FitmentRow";
import { EMPTY_FITMENT_ROW } from "@/config/fitment";
import type { FitmentRowFormState } from "@/types/marketplace";

interface ProductSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  vehicle: FitmentRowFormState;
  onVehicleChange: (vehicle: FitmentRowFormState) => void;
}

// "Toyota · Camry · 2015–2019"; an open end reads "2015+" or "–2019".
function vehicleLabel({ make, model, model_code, year_from, year_to }: FitmentRowFormState) {
  const years = year_from && year_to ? `${year_from}–${year_to}` : year_from ? `${year_from}+` : year_to ? `–${year_to}` : "";
  return [make, model, model_code, years].filter(Boolean).join(" · ");
}

// Text search; focusing it opens the vehicle picker without taking the caret.
export function ProductSearchField({ value, onChange, vehicle, onVehicleChange }: ProductSearchFieldProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const label = vehicleLabel(vehicle);
  const clearVehicle = () => onVehicleChange(EMPTY_FITMENT_ROW);

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div ref={anchorRef} className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
            <Input
              placeholder="Search products…"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-haspopup="dialog"
              className="pl-9"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="w-xl max-w-(--radix-popover-content-available-width) p-2"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            // Clicking back into the search box must not close the picker.
            if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          <FitmentRow
            row={vehicle}
            label="Search by vehicle"
            onUpdate={(patch) => onVehicleChange({ ...vehicle, ...patch })}
            onRemove={clearVehicle}
            removeLabel="Clear vehicle"
          />
        </PopoverContent>
      </Popover>

      {label && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 rounded-full px-3 text-xs"
          onClick={clearVehicle}
          aria-label={`Clear vehicle filter ${label}`}
          title="Clear vehicle filter"
        >
          <Car className="h-3.5 w-3.5 text-fg/45" />
          {label}
          <X className="h-3 w-3 text-fg/45" />
        </Button>
      )}
    </div>
  );
}
