import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ProductVehicleSection } from "@/components/products/ProductVehicleSection";
import { cn } from "@/utils/cn";

type VehicleValues = React.ComponentProps<typeof ProductVehicleSection>["values"];

interface ProductFitmentGroupProps {
  values: VehicleValues;
  onChange: React.ComponentProps<typeof ProductVehicleSection>["onChange"];
  yearRangeError?: string;
}

function summarise(v: VehicleValues) {
  const vehicle = [v.vehicle_make, v.vehicle_model, v.vehicle_model_code].filter(Boolean).join(" ");
  const years = v.vehicle_year ? `${v.vehicle_year} – ${v.vehicle_year_to || "present"}` : "";
  return [vehicle || "No make selected", years].filter(Boolean).join(" · ");
}

// Collapsible vehicle fitment group with a one-line summary in its header.
export function ProductFitmentGroup({ values, onChange, yearRangeError }: ProductFitmentGroupProps) {
  const [open, setOpen] = useState(true);

  return (
    <section className="flex flex-col gap-4 p-5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left outline-none! focus-visible:ring-2 focus-visible:ring-ring"
      >
        <h3 className="text-sm font-semibold text-fg">Vehicle fitment</h3>
        <span className="text-xs text-fg/45">Optional</span>
        <span className="ml-auto truncate text-xs text-fg/55">{summarise(values)}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-fg/50 transition-transform", open && "rotate-180")} />
      </button>
      {open && <ProductVehicleSection values={values} onChange={onChange} yearRangeError={yearRangeError} />}
    </section>
  );
}
