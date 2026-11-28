import type { ComponentType } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";

interface CampaignTemplateTileProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
  // The "Blank" tile reads quieter than real templates.
  subtle?: boolean;
}

/** One pickable template in the template chooser. */
export function CampaignTemplateTile({ icon: Icon, title, description, onClick, subtle }: CampaignTemplateTileProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn(
        "h-auto w-full items-start justify-start gap-3 bg-card p-3 text-left font-normal hover:border-accent/60",
        subtle && "border-dashed bg-transparent",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          subtle ? "bg-bg-2 text-fg/60" : "bg-accent/10 text-accent",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 whitespace-normal">
        <span className="block text-sm font-medium text-fg">{title}</span>
        <span className="block text-xs text-fg/55">{description}</span>
      </span>
    </Button>
  );
}
