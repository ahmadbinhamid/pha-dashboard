import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/ActionsMenu";
import { DISCOUNT_TEMPLATES } from "@/config/discounts";

type Template = (typeof DISCOUNT_TEMPLATES)[number];

/** "New discount" button that starts from a template. */
export function DiscountTemplateMenu({ onPick }: { onPick: (template: Template) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          New discount
          <ChevronDown className="h-3.5 w-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {DISCOUNT_TEMPLATES.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => onPick(t)} className="items-start gap-2.5 py-2">
            <t.icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-fg">{t.label}</span>
              <span className="block text-xs text-fg/55">{t.description}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
