import { cn } from "@/utils/cn";

// Presentational drag handle for the useColumnResize hook — a thin strip on
// an element's right edge; the parent must be `position: relative` (or
// `sticky`, which also establishes a positioning context) for this to sit
// where intended.
export function ColumnResizeHandle({
  onMouseDown,
  className,
}: {
  onMouseDown: (e: React.MouseEvent) => void;
  className?: string;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize column"
      onMouseDown={(e) => {
        // Rows this renders inside (e.g. a clickable product/listing row)
        // must never treat a resize drag as a row click.
        e.stopPropagation();
        onMouseDown(e);
      }}
      className={cn(
        "absolute right-0 top-0 z-10 h-full w-1.5 -translate-x-px cursor-col-resize touch-none select-none hover:bg-accent/40 active:bg-accent/60",
        className,
      )}
    />
  );
}
