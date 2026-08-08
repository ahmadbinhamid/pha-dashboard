import * as React from "react";
import { cn } from "@/utils/cn";
import { TableHead, TableCell } from "@/components/ui/Table";

// Every data table in this app pins its first column (`sticky left-0`) so
// the row's identity stays visible while the rest scrolls horizontally.
// Before this component, each page repeated the sticky/z-index/separator
// classes by hand with a single non-responsive min-w/max-w pair (e.g.
// `min-w-64` — 256px) — fine on desktop, but on a ~375px phone that pinned
// column alone ate 70-80% of the viewport, leaving almost nothing for the
// columns a user scrolls to see. `size` picks a mobile-first width that
// widens back to the original desktop value at `sm:`, so the pinned column
// takes a much smaller share of a phone screen but looks identical on
// desktop. Centralizing this also fixes header/cell width mismatches that
// existed on a couple of pages (InventoryPage, CriticalStockCard) where the
// header and cell were hand-typed with different values.
const STICKY_SIZES = {
  // original desktop width -> [mobile min-w/max-w, sm: min-w/max-w]
  32: { head: "min-w-28 sm:min-w-32", cell: "max-w-28 sm:max-w-32" },
  36: { head: "min-w-32 sm:min-w-36", cell: "max-w-32 sm:max-w-36" },
  48: { head: "min-w-36 sm:min-w-48", cell: "max-w-36 sm:max-w-48" },
  52: { head: "min-w-40 sm:min-w-52", cell: "max-w-40 sm:max-w-52" },
  56: { head: "min-w-44 sm:min-w-56", cell: "max-w-44 sm:max-w-56" },
  64: { head: "min-w-48 sm:min-w-64", cell: "max-w-48 sm:max-w-64" },
} as const;

type StickyColumnSize = keyof typeof STICKY_SIZES;

interface StickyTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  size: StickyColumnSize;
}

interface StickyTableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  size: StickyColumnSize;
}

const StickyTableHead = React.forwardRef<HTMLTableCellElement, StickyTableHeadProps>(
  ({ size, className, ...props }, ref) => (
    <TableHead
      ref={ref}
      className={cn(
        "sticky left-0 z-2 sticky-col-header sticky-col-separator-right",
        STICKY_SIZES[size].head,
        className,
      )}
      {...props}
    />
  ),
);
StickyTableHead.displayName = "StickyTableHead";

const StickyTableCell = React.forwardRef<HTMLTableCellElement, StickyTableCellProps>(
  ({ size, className, ...props }, ref) => (
    <TableCell
      ref={ref}
      className={cn(
        "sticky left-0 z-1 sticky-col-cell sticky-col-separator-right",
        STICKY_SIZES[size].cell,
        className,
      )}
      {...props}
    />
  ),
);
StickyTableCell.displayName = "StickyTableCell";

export { StickyTableHead, StickyTableCell };
