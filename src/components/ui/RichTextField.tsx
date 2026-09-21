import { FormField } from "@/components/ui/FormField";
import { RichTextEditor } from "@/components/ui/RichTextEditor";

// FormField + RichTextEditor, so a rich-text field is declared the same way as
// an Input or Textarea one (label, hint, error, value/onChange) instead of each
// form wiring the editor up itself.
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
}) {
  return (
    <FormField label={label} hint={hint} error={error} className={className}>
      <RichTextEditor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        minHeight={minHeight}
        readOnly={disabled}
      />
    </FormField>
  );
}
