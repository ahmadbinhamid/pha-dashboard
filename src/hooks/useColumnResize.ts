import { useCallback, useRef } from "react";

interface UseColumnResizeOptions {
  onResize: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
  // Starting width to measure from if the tracked element hasn't rendered with a real width yet (e.g. before any resize has set one).
  fallbackWidth?: number;
}

// Generic drag-to-resize for any horizontally-resizable element, not table-specific: attach `elementRef` to the measured node and `onMouseDown` to an edge handle. Plain window listeners, not React drag state, since nothing here needs a re-render per pixel.
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
