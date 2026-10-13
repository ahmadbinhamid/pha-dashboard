import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/Popover";
import { ProductVehicleSearchPanel } from "@/components/products/ProductVehicleSearchPanel";
import type { ProductVehicleSearch } from "@/types/product";

interface ProductSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  vehicle: ProductVehicleSearch;
  onVehicleChange: (vehicle: ProductVehicleSearch) => void;
}

// Text search; focusing it opens the vehicle filters without taking the caret.
export function ProductSearchField({ value, onChange, vehicle, onVehicleChange }: ProductSearchFieldProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  return (
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
        className="w-xl max-w-(--radix-popover-content-available-width)"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // Clicking back into the search box must not close the filters.
          if (anchorRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
      >
        <ProductVehicleSearchPanel value={vehicle} onChange={onVehicleChange} />
      </PopoverContent>
    </Popover>
  );
}
