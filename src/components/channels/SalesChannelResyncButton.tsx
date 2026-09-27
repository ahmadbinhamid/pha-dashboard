import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip";
import { cn } from "@/utils/cn";

interface SalesChannelResyncButtonProps {
  onResync: () => void;
  disabled?: boolean;
  resyncing?: boolean;
  // Tooltip text, e.g. "Synced 2d ago".
  syncLabel: string;
}

// Icon-only re-sync beside the status badge; sync time shows on hover.
export function SalesChannelResyncButton({ onResync, disabled, resyncing, syncLabel }: SalesChannelResyncButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Wrapper keeps the tooltip working while the button is disabled. */}
        <span className="inline-flex">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-fg/40 hover:text-fg"
            onClick={onResync}
            disabled={disabled}
            aria-label={`Re-sync (${syncLabel})`}
          >
            <RefreshCw className={cn("h-4 w-4", resyncing && "animate-spin")} />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{syncLabel}</TooltipContent>
    </Tooltip>
  );
}
