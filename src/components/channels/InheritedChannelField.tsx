import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import Link from "@/components/ui/Link";
import { OverrideField } from "@/components/listings/OverrideField";
import { cn } from "@/utils/cn";

interface InheritedChannelFieldProps {
  label: string;
  channelName: string;
  // The product's value, formatted; null when the product has none.
  productValue: string | null;
  overridden: boolean;
  onReset: () => void;
  error?: string;
  // The editor shown while overriding.
  children: React.ReactNode;
}

// A product value a channel reuses: shown read-only, overridable on request.
export function InheritedChannelField({
  label,
  channelName,
  productValue,
  overridden,
  onReset,
  error,
  children,
}: InheritedChannelFieldProps) {
  const [editing, setEditing] = useState(false);

  if (overridden || editing) {
    return (
      <OverrideField
        label={label}
        overridden={overridden}
        onReset={() => {
          onReset();
          setEditing(false);
        }}
        error={error}
        hint={overridden ? `${channelName} only. The product says ${productValue ?? "nothing"}.` : undefined}
      >
        {children}
        {!overridden && (
          <Button type="button" variant="ghost" size="sm" className="h-7 self-start px-2 text-xs" onClick={() => setEditing(false)}>
            Keep the product value
          </Button>
        )}
      </OverrideField>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md bg-bg-2 px-3 py-2">
        <span className={cn("text-sm font-medium", productValue ? "text-fg" : "text-fg/50")}>
          {productValue ?? "Not set on the product"}
        </span>
        <span className="text-xs text-fg/55">
          from product ·{" "}
          <Link href="?tab=details" className="font-medium text-accent hover:underline">
            Edit in Details
          </Link>
        </span>
      </div>
      <Button type="button" variant="ghost" size="sm" className="h-7 self-start px-2 text-xs" onClick={() => setEditing(true)}>
        Override for {channelName}
      </Button>
      {error && (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
