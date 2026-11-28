import { FormField } from "@/components/ui/FormField";
import { RichTextEditor } from "@/components/ui/RichTextEditor";

// FormField + RichTextEditor, declared like an Input instead of hand-wired.
export function RichTextField({
  label,
  hint,
  error,
  value,
  onChange,
  placeholder,
  minHeight,
  disabled,
  className,
  enableLinks,
  enableImages,
}: {
  label?: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  /** Renders read-only — the toolbar is hidden rather than greyed out. */
  disabled?: boolean;
  className?: string;
  enableLinks?: boolean;
  enableImages?: boolean;
}) {
  return (
    <FormField label={label} hint={hint} error={error} className={className}>
      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        minHeight={minHeight}
        readOnly={disabled}
        enableLinks={enableLinks}
        enableImages={enableImages}
      />
    </FormField>
  );
}
