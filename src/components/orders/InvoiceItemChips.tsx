import { AUTHENTICITY_LABEL, CONDITION_LABEL } from "@/config/productOptions";
import type { OrderItem } from "@/types/orders";

interface InvoiceItemChipsProps {
  item: Pick<OrderItem, "condition" | "authenticity">;
}

// Inline after the line title; border-current follows the invoice's ink.
export function InvoiceItemChips({ item }: InvoiceItemChipsProps) {
  const chips = [
    item.condition ? CONDITION_LABEL[item.condition] : null,
    item.authenticity ? AUTHENTICITY_LABEL[item.authenticity] : null,
  ].filter(Boolean);
  if (!chips.length) return null;

  return (
    <span className="ml-1.5 inline-flex gap-1 align-middle">
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded-xs border border-current px-1 py-px text-4xs font-bold uppercase leading-none tracking-wider"
        >
          {chip}
        </span>
      ))}
    </span>
  );
}
