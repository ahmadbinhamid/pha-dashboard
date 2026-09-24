import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import type { ChannelFieldDescriptor, ChannelFieldOption } from "@/types/channel";

interface ChannelFieldInputProps {
  descriptor: ChannelFieldDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  // Dynamic options; static ones come on the descriptor.
  options?: ChannelFieldOption[];
  // Server-side fallback for a blank value (makes the field optional).
  fallback?: string | null;
  // Where the fallback comes from, e.g. "From product" / "eBay default".
  fallbackPrefix?: string;
  // Control only; a wrapper (InheritedChannelField) owns label and error.
  bare?: boolean;
}

// Generic fieldSchema field; custom types use channelFieldRegistry.
export function ChannelFieldInput({
  descriptor,
  value,
  onChange,
  error,
  options,
  fallback,
  fallbackPrefix = "Default",
  bare = false,
}: ChannelFieldInputProps) {
  const { label, type, helpText } = descriptor;
  const required = descriptor.required && !fallback;
  const stringValue = value == null ? "" : String(value);

  if (type === "boolean") {
    return <Switch checked={!!value} onCheckedChange={onChange} label={label} description={helpText} />;
  }

  let control: React.ReactNode;
  if (type === "select" || type === "policy" || type === "category") {
    const list = options ?? descriptor.options ?? [];
    const fallbackLabel = fallback ? list.find((o) => o.value === fallback)?.label ?? fallback : null;
    const selectOptions = [
      ...(fallbackLabel ? [{ value: "", label: `${fallbackPrefix} — ${fallbackLabel}` }] : []),
      // Optional with no fallback: an explicit "None" keeps the value clearable.
      ...(!fallbackLabel && !required ? [{ value: "", label: "None" }] : []),
      // Keep a stored value outside the list selectable instead of blank.
      ...(stringValue && !list.some((o) => o.value === stringValue) ? [{ value: stringValue, label: stringValue }] : []),
      ...list,
    ];
    control = <SingleSelect options={selectOptions} value={stringValue} onChange={onChange} />;
  } else if (type === "textarea") {
    control = <Textarea value={stringValue} onChange={(e) => onChange(e.target.value)} rows={3} />;
  } else {
    control = (
      <Input
        type={type === "number" ? "number" : "text"}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        value={stringValue}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (bare) return <>{control}</>;
  return (
    <FormField label={label} required={required} error={error} hint={helpText}>
      {control}
    </FormField>
  );
}
