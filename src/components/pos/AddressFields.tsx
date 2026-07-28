import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import type { OrderAddress } from "@/types/orders";

interface AddressFieldsProps {
  value: OrderAddress;
  onChange: (value: OrderAddress) => void;
  errors?: Partial<Record<keyof OrderAddress, string>>;
  required?: boolean;
}

export function AddressFields({ value, onChange, errors, required = true }: AddressFieldsProps) {
  const set = (key: keyof OrderAddress, v: string) => onChange({ ...value, [key]: v });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Address" required={required} error={errors?.address} className="sm:col-span-2">
        <Input value={value.address} onChange={(e) => set("address", e.target.value)} placeholder="123 Example St" />
      </FormField>
      <FormField label="Suburb" required={required} error={errors?.suburb}>
        <Input value={value.suburb} onChange={(e) => set("suburb", e.target.value)} placeholder="Suburb" />
      </FormField>
      <FormField label="State" required={required} error={errors?.state}>
        <Input value={value.state} onChange={(e) => set("state", e.target.value)} placeholder="NSW" />
      </FormField>
      <FormField label="Postcode" required={required} error={errors?.postcode} className="sm:col-span-2">
        <Input value={value.postcode} onChange={(e) => set("postcode", e.target.value)} placeholder="2000" />
      </FormField>
    </div>
  );
}
