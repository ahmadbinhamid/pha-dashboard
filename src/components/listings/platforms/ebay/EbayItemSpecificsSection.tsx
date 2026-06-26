import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getCategoryAspects } from "@/lib/api/ebay";
import type { EbayListingFormState } from "@/types/marketplace";
import type { CategoryAspect } from "@/types/ebay";
import { Plus, X } from "lucide-react";

// Aspects already captured by dedicated form fields — skip them in dynamic list
const STATIC_ASPECT_NAMES = new Set([
  "brand",
  "manufacturer part number",
  "mpn",
  "superseded part number",
]);

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

  // Dynamic aspects from eBay Taxonomy API
  const categoryId = form.ebay_category_id;
  const [showAllOptional, setShowAllOptional] = useState(false);

  const { data: aspectsData, isLoading: aspectsLoading } = useQuery({
    queryKey: ["ebay-category-aspects", categoryId],
    queryFn: () => getCategoryAspects(categoryId),
    enabled: !!categoryId,
    staleTime: 30 * 60 * 1000,
  });

  // Reset optional toggle when category changes
  useEffect(() => {
    setShowAllOptional(false);
  }, [categoryId]);

  const allAspects = (aspectsData?.data?.aspects ?? []).filter(
    (a) => !STATIC_ASPECT_NAMES.has(a.name.toLowerCase()),
  );
  const requiredAspects = allAspects.filter((a) => a.required);
  const optionalAspects = allAspects.filter((a) => !a.required);

  const displayedOptional = showAllOptional
    ? optionalAspects
    : optionalAspects.filter((a) => (specs.aspects?.[a.name] || "").trim());

  function setAspectValue(name: string, value: string) {
    patch({ aspects: { ...(specs.aspects ?? {}), [name]: value } });
  }

  function renderAspectInput(aspect: CategoryAspect) {
    const value = specs.aspects?.[aspect.name] ?? "";
    if (aspect.mode === "SELECTION_ONLY" && aspect.values.length > 0) {
      return (
        <Select value={value} onValueChange={(v) => setAspectValue(aspect.name, v)}>
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {aspect.values.map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return (
      <>
        {aspect.values.length > 0 && (
          <datalist id={`aspect-${aspect.name}`}>
            {aspect.values.map((v) => <option key={v} value={v} />)}
          </datalist>
        )}
        <Input
          value={value}
          onChange={(e) => setAspectValue(aspect.name, e.target.value)}
          placeholder={aspect.values.length > 0 ? `e.g. ${aspect.values[0]}` : undefined}
          list={aspect.values.length > 0 ? `aspect-${aspect.name}` : undefined}
        />
      </>
    );
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
            placeholder='e.g. 45022-TBC-A01 or "Does Not Apply"'
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

      {/* Dynamic category aspects — only shown when a category is selected */}
      {categoryId && (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium text-fg">
            Category Aspects
            {aspectsLoading && (
              <span className="ml-2 text-xs font-normal text-fg/40">Loading…</span>
            )}
          </p>

          {/* Required aspects */}
          {requiredAspects.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {requiredAspects.map((aspect) => (
                <FormField key={aspect.name} label={aspect.name} required>
                  {renderAspectInput(aspect)}
                </FormField>
              ))}
            </div>
          )}

          {/* Optional aspects */}
          {optionalAspects.length > 0 && (
            <div className="space-y-3">
              {displayedOptional.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {displayedOptional.map((aspect) => (
                    <FormField key={aspect.name} label={aspect.name}>
                      {renderAspectInput(aspect)}
                    </FormField>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowAllOptional((v) => !v)}
                className="text-xs text-fg/50 underline-offset-2 hover:text-fg hover:underline"
              >
                {showAllOptional
                  ? "Hide optional aspects"
                  : `Show ${optionalAspects.length} optional aspect${optionalAspects.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          )}

          {!aspectsLoading && allAspects.length === 0 && aspectsData && (
            <p className="text-xs text-fg/40">No aspect data available for this category.</p>
          )}
        </div>
      )}
    </div>
  );
}
