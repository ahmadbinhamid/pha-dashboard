import type { ComponentType } from "react";

interface EmailBlockPlaceholderProps {
  icon: ComponentType<{ className?: string }>;
  label: string;
}

/** Stand-in on the builder canvas for a block that has no content yet. */
export function EmailBlockPlaceholder({ icon: Icon, label }: EmailBlockPlaceholderProps) {
  return (
    <div className="flex h-28 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-bg-2 text-xs text-fg/50">
      <Icon className="h-5 w-5" />
      {label}
    </div>
  );
}
