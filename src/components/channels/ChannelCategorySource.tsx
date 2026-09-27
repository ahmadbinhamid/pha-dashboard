import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import Link from "@/components/ui/Link";
import { CATEGORY_SOURCE_LABEL } from "@/config/salesChannels";
import type { MappedCategory } from "@/types/categoryMapping";

interface Props {
  channelName: string;
  // The listing's own category, if set.
  listingValue: string | null | undefined;
  mapped: MappedCategory | null | undefined;
  required: boolean;
  // Clears the listing's own category so the mapping applies again.
  onReset?: () => void;
}

// Shows where the effective category comes from (listing, mapping or unset).
export function ChannelCategorySource({ channelName, listingValue, mapped, required, onReset }: Props) {
  if (listingValue) {
    return (
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-fg/60">
        <Badge variant="warn">{CATEGORY_SOURCE_LABEL.override(channelName)}</Badge>
        {mapped && onReset && (
          <Button type="button" variant="ghost" size="sm" onClick={onReset} className="h-7 gap-1 px-2 text-xs">
            <RotateCcw className="h-3 w-3" />
            Reset to mapping ({mapped.name ?? mapped.id})
          </Button>
        )}
      </p>
    );
  }
  if (mapped) {
    return (
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-fg/60">
        <Badge variant="muted">{CATEGORY_SOURCE_LABEL.mapping}</Badge>
        <span>
          {mapped.name ?? "Category"} ({mapped.id})
        </span>
      </p>
    );
  }
  return (
    <p className={required ? "text-xs text-warn" : "text-xs text-fg/55"}>
      No category default for this product.{" "}
      <Link href="/settings/integrations/channel-categories" className="font-medium text-accent hover:underline">
        Map your categories
      </Link>{" "}
      {required ? "or pick one here." : "(optional)."}
    </p>
  );
}
