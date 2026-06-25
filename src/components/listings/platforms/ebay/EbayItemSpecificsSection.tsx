import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import type { EbayListingFormState } from "@/types/marketplace";
import { Plus, X } from "lucide-react";

interface Props {
  form: EbayListingFormState;
  onChange: (patch: Partial<EbayListingFormState>) => void;
}

function patchSpecs(
  form: EbayListingFormState,
  onChange: Props["onChange"],
  patch: Partial<EbayListingFormState["item_specifics"]>,
) {
  onChange({ item_specifics: { ...form.item_specifics, ...patch } });
}

export function EbayItemSpecificsSection({ form, onChange }: Props) {
  const specs = form.item_specifics;
  const patch = (p: Partial<EbayListingFormState["item_specifics"]>) =>
    patchSpecs(form, onChange, p);

  const rawSpn = specs.superseded_part_number as unknown;
  const spnList: string[] = Array.isArray(rawSpn) && (rawSpn as string[]).length > 0
    ? (rawSpn as string[])
    : [""];

  function updateSpn(index: number, value: string) {
    const next = [...spnList];
    next[index] = value;
    patch({ superseded_part_number: next });
  }

  function addSpn() {
    patch({ superseded_part_number: [...spnList, ""] });
  }

  function removeSpn(index: number) {
    const next = spnList.filter((_, i) => i !== index);
    patch({ superseded_part_number: next.length > 0 ? next : [""] });
  }

  return (
    <div className="space-y-4">
      {/* Brand + MPN */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Brand">
          <Input
            value={specs.brand}
            onChange={(e) => patch({ brand: e.target.value })}
            placeholder="e.g. Honda"
          />
        </FormField>

        <FormField label="Manufacturer Part Number (MPN)">
          <Input
            value={specs.mpn}
            onChange={(e) => patch({ mpn: e.target.value })}
            placeholder="e.g. 45022-TBC-A01"
          />
        </FormField>
      </div>

      {/* Superseded Part Numbers — dynamic array */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-fg">
          Superseded Part Number(s)
        </label>

        <div className="space-y-2">
          {spnList.map((val, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-xs border border-border bg-bg focus-within:ring-1 focus-within:ring-primary/40">
                <span className="shrink-0 border-r border-border bg-bg-2 px-3 py-2 text-xs font-medium text-fg/45 select-none">
                  #{i + 1}
                </span>
                <input
                  type="text"
                  value={val}
                  onChange={(e) => updateSpn(i, e.target.value)}
                  placeholder="e.g. 45022TBCA01"
                  className="w-full bg-transparent px-3 py-2 text-sm text-fg placeholder:text-fg/35 outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => removeSpn(i)}
                disabled={spnList.length === 1 && val === ""}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xs border border-border text-fg/40 transition-colors hover:border-danger/50 hover:bg-danger/5 hover:text-danger disabled:cursor-not-allowed disabled:opacity-30"
                title="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSpn}
          className="gap-1.5 text-xs"
        >
          <Plus className="h-3 w-3" />
          Add Part Number
        </Button>

        <p className="text-[11px] text-fg/40">
          List all older part numbers this part supersedes — helps buyers find this listing.
        </p>
      </div>
    </div>
  );
}
