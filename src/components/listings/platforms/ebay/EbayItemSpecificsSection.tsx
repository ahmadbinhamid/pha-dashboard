import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { EbayListingFormState } from "@/types/marketplace";

const PLACEMENTS = [
  "Front", "Rear", "Left", "Right",
  "Front Left", "Front Right", "Rear Left", "Rear Right", "Universal",
];

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

  return (
    <div className="space-y-4">
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

      <FormField label="Superseded Part Number">
        <Input
          value={specs.superseded_part_number}
          onChange={(e) => patch({ superseded_part_number: e.target.value })}
          placeholder="e.g. 45022TBCA01"
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Placement on Vehicle">
          <Select
            value={specs.placement_on_vehicle}
            onValueChange={(v) => patch({ placement_on_vehicle: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select placement" />
            </SelectTrigger>
            <SelectContent>
              {PLACEMENTS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Part Type">
          <Input
            value={specs.part_type}
            onChange={(e) => patch({ part_type: e.target.value })}
            placeholder="e.g. Brake Pad Set"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Finish">
          <Input
            value={specs.finish}
            onChange={(e) => patch({ finish: e.target.value })}
            placeholder="e.g. Powder Coated"
          />
        </FormField>

        <FormField label="Warranty">
          <Input
            value={specs.warranty}
            onChange={(e) => patch({ warranty: e.target.value })}
            placeholder="e.g. 90 Day"
          />
        </FormField>
      </div>

      <div className="flex flex-wrap gap-6 pt-1">
        <div className="flex items-center gap-2">
          <Switch
            checked={specs.custom_bundle}
            onCheckedChange={(v) => patch({ custom_bundle: v })}
          />
          <span className="text-sm text-fg">Custom Bundle</span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={specs.modified_item}
            onCheckedChange={(v) => patch({ modified_item: v })}
          />
          <span className="text-sm text-fg">Modified Item</span>
        </div>
      </div>
    </div>
  );
}
