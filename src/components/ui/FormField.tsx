import { cn } from "@/utils/cn";
import { Label } from "@/components/ui/Label";
import { useFieldDensity } from "@/components/ui/FieldDensity";

type FormFieldProps = {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  // Right side of the label row, e.g. a character counter.
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  aside,
  className,
  children,
}: FormFieldProps) {
  const compact = useFieldDensity() === "compact";
  return (
    <div className={cn("flex flex-col", compact ? "gap-1" : "gap-1.5", className)}>
      {label && aside ? (
        <div className="flex items-center gap-2">
          <Label htmlFor={htmlFor} required={required}>
            {label}
          </Label>
          <span className="ml-auto text-xs text-fg/45">{aside}</span>
        </div>
      ) : label ? (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-fg/55">{hint}</p>
      ) : null}
    </div>
  );
}
