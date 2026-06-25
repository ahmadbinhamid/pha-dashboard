import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { EbayListingFormState, FitmentRowFormState } from "@/types/marketplace";
import { Plus, Trash2, Car } from "lucide-react";

interface Props {
  form: EbayListingFormState;
  onChange: (patch: Partial<EbayListingFormState>) => void;
}

const EMPTY_ROW: FitmentRowFormState = { make: "", model: "", year_from: "", year_to: "" };

export function EbayVehicleFitmentSection({ form, onChange }: Props) {
  const rows = form.fitment;

  function updateRow(index: number, patch: Partial<FitmentRowFormState>) {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    onChange({ fitment: next });
  }

  function addRow() {
    onChange({ fitment: [...rows, { ...EMPTY_ROW }] });
  }

  function removeRow(index: number) {
    onChange({ fitment: rows.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xs border border-dashed border-border py-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xs bg-bg-2">
            <Car className="h-5 w-5 text-fg/30" />
          </div>
          <div>
            <p className="text-sm font-medium text-fg">No vehicles added yet</p>
            <p className="mt-0.5 text-xs text-fg/45">
              Add make, model and year range to help buyers find compatible parts.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Vehicle
          </Button>
        </div>
      ) : (
        <>
          {/* Column headers */}
          <div className="hidden grid-cols-[1fr_1fr_90px_90px_36px] gap-2 sm:grid">
            {["Make", "Model", "Year From", "Year To", ""].map((h, i) => (
              <span key={i} className="text-[11px] font-semibold uppercase tracking-wider text-fg/40">
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 rounded-xs border border-border bg-bg-2/30 p-3 sm:grid-cols-[1fr_1fr_90px_90px_36px] sm:items-center sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0"
              >
                {/* Mobile label + Make */}
                <div className="sm:contents">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-fg/40 sm:hidden">
                    Make
                  </span>
                  <Input
                    value={row.make}
                    onChange={(e) => updateRow(i, { make: e.target.value })}
                    placeholder="e.g. Toyota"
                  />
                </div>

                {/* Model */}
                <div className="sm:contents">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-fg/40 sm:hidden">
                    Model
                  </span>
                  <Input
                    value={row.model}
                    onChange={(e) => updateRow(i, { model: e.target.value })}
                    placeholder="e.g. Corolla"
                  />
                </div>

                {/* Year From */}
                <div className="sm:contents">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-fg/40 sm:hidden">
                    Year From
                  </span>
                  <Input
                    type="number"
                    min="1900"
                    max="2099"
                    value={row.year_from}
                    onChange={(e) => updateRow(i, { year_from: e.target.value })}
                    placeholder="2018"
                  />
                </div>

                {/* Year To */}
                <div className="sm:contents">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-fg/40 sm:hidden">
                    Year To
                  </span>
                  <Input
                    type="number"
                    min="1900"
                    max="2099"
                    value={row.year_to}
                    onChange={(e) => updateRow(i, { year_to: e.target.value })}
                    placeholder="2023"
                  />
                </div>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="flex h-8 w-8 items-center justify-center self-end rounded-xs border border-border text-fg/40 transition-colors hover:border-danger/50 hover:bg-danger/5 hover:text-danger sm:self-auto"
                  title="Remove vehicle"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1.5 text-xs">
            <Plus className="h-3 w-3" />
            Add Vehicle
          </Button>
        </>
      )}

      <p className="text-[11px] text-fg/40">
        Add all compatible vehicles. eBay uses this to display your listing in fitment search results.
      </p>
    </div>
  );
}
