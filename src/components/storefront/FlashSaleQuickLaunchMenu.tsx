import { ChevronDown, Rocket } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/ActionsMenu";
import { FLASH_SALE_PRESETS } from "@/config/storefront";
import type { Category } from "@/types/product";
import type { FlashSalePreset } from "@/types/storefront";

interface FlashSaleQuickLaunchMenuProps {
  categories: Category[];
  disabled: boolean;
  onLaunch: (preset: FlashSalePreset, categoryIds: string[]) => void;
}

function matchedCategoryIds(preset: FlashSalePreset, categories: Category[]) {
  const match = preset.categoryMatch;
  return match ? categories.filter((c) => match.test(c.name)).map((c) => c._id) : [];
}

/** Creates (or refreshes) a preset discount and promotes it in one click. */
export function FlashSaleQuickLaunchMenu({ categories, disabled, onLaunch }: FlashSaleQuickLaunchMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary" size="sm" disabled={disabled}>
          <Rocket className="h-4 w-4" />
          Quick launch
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {FLASH_SALE_PRESETS.map((preset) => {
          const matched = matchedCategoryIds(preset, categories);
          const missingCategory = !!preset.categoryMatch && matched.length === 0;
          return (
            <DropdownMenuItem
              key={preset.id}
              disabled={missingCategory}
              onSelect={() => onLaunch(preset, matched)}
              className="items-start gap-2.5 py-2 data-disabled:opacity-50"
            >
              <span className="text-base leading-none" aria-hidden>
                {preset.emoji}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">{preset.label}</span>
                <span className="block text-xs text-fg/55">
                  {missingCategory ? "Needs a Brakes category" : `Code ${preset.sale.code} · runs ${preset.durationDays} days`}
                </span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
