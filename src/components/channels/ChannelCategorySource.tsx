import { Badge } from "@/components/ui/Badge";
import Link from "@/components/ui/Link";
import type { MappedCategory } from "@/types/categoryMapping";

interface Props {
  // The listing's own category, if set.
  listingValue: string | null | undefined;
  mapped: MappedCategory | null | undefined;
  required: boolean;
}

// Shows where the effective category comes from (listing, mapping or unset).
export function ChannelCategorySource({ listingValue, mapped, required }: Props) {
  if (listingValue) {
    return (
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-fg/60">
        <Badge variant="outline">Set on this product</Badge>
        {mapped && <span>Clear it to use the category default ({mapped.name ?? mapped.id}).</span>}
      </p>
    );
  }
  if (mapped) {
    return (
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-fg/60">
        <Badge variant="muted">From category default</Badge>
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
