import * as React from "react";
import { cn } from "@/utils/cn";

// Data-table primitives. Every table in the app is built from these, so the
// look is set here rather than per page.
//
// Density and header treatment follow the reference design: 12px body text,
// and a header that reads as a quiet label — sentence case, medium weight,
// low contrast — instead of the shouty uppercase-tracked style. Two cards
// (CriticalStockCard, SalesPerformanceTable) were already overriding the old
// header to exactly this, which is what settled it.

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <table ref={ref} className={cn("w-full caption-bottom text-xs", className)} {...props} />
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("border-b border-border bg-muted/40", className)} {...props} />
  ),
);
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    // A lighter rule between rows than the header's — the divider should
    // separate rows without striping the table.
    <tbody ref={ref} className={cn("divide-y divide-border/60", className)} {...props} />
  ),
);
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn("transition-colors hover:bg-muted/40", className)} {...props} />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-9 px-3.5 text-left align-middle whitespace-nowrap",
        "text-[11px] font-medium text-fg/45",
        // Extra breathing room at the card's edges, where the table meets its border.
        "first:pl-5 last:pr-5",
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn("px-3.5 py-3 align-middle text-fg first:pl-5 last:pr-5", className)}
      {...props}
    />
  ),
);
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
