import { ColorSwatchInput } from "@/components/ui/ColorSwatchInput";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";

interface EmailColorFieldProps {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
  // Optional colours can be cleared back to the design's default.
  clearable?: boolean;
  fallback?: string;
}

export function EmailColorField({ label, value, onChange, clearable, fallback = "#333333" }: EmailColorFieldProps) {
  return (
    <FormField
      label={label}
      aside={
        clearable && value ? (
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onChange("")}>
            Reset
          </Button>
        ) : undefined
      }
    >
      <ColorSwatchInput value={value || fallback} onChange={onChange} />
    </FormField>
  );
}
