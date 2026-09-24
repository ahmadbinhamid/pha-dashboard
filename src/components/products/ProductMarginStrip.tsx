import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/utils/cn";

interface ProductMarginStripProps {
  price: string;
  cost: string;
}

// Live margin; turns danger with the reason when the product sells at a loss.
export function ProductMarginStrip({ price, cost }: ProductMarginStripProps) {
  const priceNumber = Number(price) || 0;
  const hasMargin = priceNumber > 0 && cost !== "";
  const profit = priceNumber - (Number(cost) || 0);
  const loss = hasMargin && profit < 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-md px-3 py-2 text-xs",
        loss ? "bg-danger/10 text-danger" : "bg-bg-2 text-fg/60",
      )}
    >
      <span>
        Margin
        <b className={cn("ml-1 text-sm font-semibold", loss ? "text-danger" : "text-fg")}>
          {hasMargin ? `${Math.round((profit / priceNumber) * 100)}%` : "—"}
        </b>
      </span>
      <span>
        Profit / unit
        <b className={cn("ml-1 text-sm font-semibold", loss ? "text-danger" : "text-fg")}>
          {hasMargin ? formatCurrency(profit) : "—"}
        </b>
      </span>
      {loss ? (
        <span className="ml-auto flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          Cost is higher than the retail price
        </span>
      ) : (
        !hasMargin && <span className="ml-auto">Enter retail and cost to see margin.</span>
      )}
    </div>
  );
}
