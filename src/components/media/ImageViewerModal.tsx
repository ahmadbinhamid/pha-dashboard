import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { cn } from "@/utils/cn";
import type { Attachment } from "@/types/product";

interface ImageViewerModalProps {
  images: Attachment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIndex?: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;

// Self-contained full-screen lightbox: scroll/buttons to zoom, drag to pan
// once zoomed, arrow keys or edge buttons to move between images. Built
// directly on the Radix Dialog primitives (rather than the shared Modal)
// since that component is capped at max-w-lg and isn't meant for full-bleed
// content.
export function ImageViewerModal({ images, open, onOpenChange, initialIndex = 0 }: ImageViewerModalProps) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (open) setIndex(initialIndex);
  }, [open, initialIndex]);

  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const goTo = (next: number) => {
    if (images.length === 0) return;
    const wrapped = (next + images.length) % images.length;
    setIndex(wrapped);
    resetView();
  };

  const goPrev = () => goTo(index - 1);
  const goNext = () => goTo(index + 1);

  const zoomBy = (delta: number) => {
    setScale((s) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta));
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "+" || e.key === "=") zoomBy(0.5);
      else if (e.key === "-") zoomBy(-0.5);
      else if (e.key === "0") resetView();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, images.length]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 0.25 : -0.25);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (scale <= MIN_SCALE) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: offset.x, originY: offset.y };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset({ x: dragRef.current.originX + dx, y: dragRef.current.originY + dy });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    if (scale > MIN_SCALE) resetView();
    else zoomBy(1.5);
  };

  const current = images[index];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/90",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-50 flex flex-col outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">
            {current?.original_name || current?.file_name || "Image preview"}
          </DialogPrimitive.Title>

          {/* Top bar */}
          <div className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6">
            <span className="text-xs font-medium tabular-nums text-white/70">
              {images.length > 0 ? `${index + 1} / ${images.length}` : ""}
            </span>
            <DialogPrimitive.Close
              className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white outline-none! focus-visible:ring-2 focus-visible:ring-white/50"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>

          {/* Image stage */}
          <div
            className="relative min-h-0 flex-1 overflow-hidden select-none"
            onWheel={handleWheel}
          >
            {current && (
              <div
                className={cn(
                  "flex h-full w-full items-center justify-center",
                  scale > MIN_SCALE ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in",
                )}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onDoubleClick={handleDoubleClick}
              >
                <img
                  src={current.url}
                  alt={current.original_name || current.file_name}
                  draggable={false}
                  className="max-h-full max-w-full object-contain transition-transform duration-100 ease-out"
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  }}
                />
              </div>
            )}

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Previous image"
                  className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-4"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Next image"
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-4"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>

          {/* Zoom controls */}
          <div className="flex shrink-0 items-center justify-center gap-2 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => zoomBy(-0.5)}
              disabled={scale <= MIN_SCALE}
              aria-label="Zoom out"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={resetView}
              disabled={scale === MIN_SCALE && offset.x === 0 && offset.y === 0}
              aria-label="Reset zoom"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => zoomBy(0.5)}
              disabled={scale >= MAX_SCALE}
              aria-label="Zoom in"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
