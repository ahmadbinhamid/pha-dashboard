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

const AU_SHIPPING_SERVICES = [
  "Australia Post – Standard",
  "Australia Post – Express",
  "Australia Post – Registered",
  "Couriers Please",
  "Fastway / Aramex",
  "StarTrack",
  "TNT / FedEx",
  "eParcel",
  "Other",
];

const HANDLING_TIMES = [
  { value: "1", label: "1 Business Day" },
  { value: "2", label: "2 Business Days" },
  { value: "3", label: "3 Business Days" },
  { value: "5", label: "5 Business Days" },
  { value: "10", label: "10 Business Days" },
];

interface Props {
  form: EbayListingFormState;
  onChange: (patch: Partial<EbayListingFormState>) => void;
}

export function EbayShippingSection({ form, onChange }: Props) {
  const pkg = form.package;

  function patchPkg(patch: Partial<EbayListingFormState["package"]>) {
    onChange({ package: { ...pkg, ...patch } });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Domestic Shipping Service">
          <Select
            value={form.shipping_service}
            onValueChange={(v) => onChange({ shipping_service: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select service" />
            </SelectTrigger>
            <SelectContent>
              {AU_SHIPPING_SERVICES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Handling Time">
          <Select
            value={form.handling_time}
            onValueChange={(v) => onChange({ handling_time: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select handling time" />
            </SelectTrigger>
            <SelectContent>
              {HANDLING_TIMES.map((h) => (
                <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={form.free_shipping}
            onCheckedChange={(v) => onChange({ free_shipping: v })}
          />
          <span className="text-sm text-fg">Free Shipping</span>
        </div>

        <FormField label="Item Location (Postcode)" className="max-w-[180px]">
          <Input
            value={form.item_location_zip}
            onChange={(e) => onChange({ item_location_zip: e.target.value })}
            placeholder="e.g. 2000"
            maxLength={4}
          />
        </FormField>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-fg">Package Dimensions &amp; Weight</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FormField label="Length (cm)">
            <Input type="number" min="0" value={pkg.length}
              onChange={(e) => patchPkg({ length: e.target.value })} placeholder="30" />
          </FormField>
          <FormField label="Width (cm)">
            <Input type="number" min="0" value={pkg.width}
              onChange={(e) => patchPkg({ width: e.target.value })} placeholder="20" />
          </FormField>
          <FormField label="Height (cm)">
            <Input type="number" min="0" value={pkg.height}
              onChange={(e) => patchPkg({ height: e.target.value })} placeholder="10" />
          </FormField>
          <FormField label="Weight (kg)">
            <Input type="number" min="0" step="0.1" value={pkg.weight}
              onChange={(e) => patchPkg({ weight: e.target.value })} placeholder="1.5" />
          </FormField>
        </div>
      </div>
    </div>
  );
}
