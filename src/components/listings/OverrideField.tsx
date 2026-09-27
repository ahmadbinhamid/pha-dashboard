import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";

interface OverrideFieldProps {
  label: string;
  htmlFor?: string;
  // false means the product value is used.
  overridden: boolean;
  // Clears the override back to the product value.
  onReset: () => void;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

// Override input with "using product value" / "overridden" state and a reset.
export function OverrideField({ label, htmlFor, overridden, onReset, required, error, hint, children }: OverrideFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
        <div className="flex items-center gap-1.5">
          <Badge variant={overridden ? "warn" : "muted"}>{overridden ? "Overridden" : "Using product value"}</Badge>
          {overridden && (
            <Button type="button" variant="ghost" size="sm" onClick={onReset} className="h-7 gap-1 px-2 text-xs">
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          )}
        </div>
      </div>
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
