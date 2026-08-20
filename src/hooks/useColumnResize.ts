import { useCallback, useRef } from "react";

interface UseColumnResizeOptions {
  onResize: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  // Starting width to measure from if the tracked element hasn't rendered
  // with a real width yet (e.g. the very first drag before any resize has
  // set an explicit width).
  fallbackWidth?: number;
}

// Generic drag-to-resize for any horizontally-resizable element — a table
// column header today, but not table-specific: attach `elementRef` to
// whatever node's current width should be measured on drag start, and wire
// `onMouseDown` to a handle rendered at its edge. Plain window listeners
// (added on mousedown, removed on mouseup) rather than React drag state —
// the drag only needs to read the pointer position and call onResize, so
// there's nothing worth a re-render for on every pixel of movement.
export function useColumnResize<T extends HTMLElement>({
  onResize,
  minWidth = 160,
  maxWidth = 600,
  fallbackWidth,
}: UseColumnResizeOptions) {
  const elementRef = useRef<T | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = elementRef.current?.getBoundingClientRect().width ?? fallbackWidth ?? minWidth;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const next = Math.min(maxWidth, Math.max(minWidth, startWidth + (moveEvent.clientX - startX)));
        onResize(next);
      };
      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [onResize, minWidth, maxWidth, fallbackWidth],
  );

  return { elementRef, onMouseDown };
}
