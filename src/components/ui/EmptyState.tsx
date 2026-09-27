import type { ComponentType, ReactNode } from "react";
import { cn } from "@/utils/cn";

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  className?: string;
}

// Centred icon + message for an empty list or panel.
export function EmptyState({ icon: Icon, title, description, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-5 py-12 text-center", className)}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
        <Icon className="h-5 w-5 text-accent" />
      </div>
      <p className="text-sm font-semibold text-fg">{title}</p>
      {description && <p className="max-w-sm text-xs text-fg/55">{description}</p>}
    </div>
  );
}
