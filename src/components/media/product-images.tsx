import { useState } from "react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { Gallery } from "@/components/media/gallery";
import { useToast } from "@/context";
import type { Attachment } from "@/types/product";
import { Star, Trash2, GripVertical, Plus } from "lucide-react";

interface ProductImagesProps {
  images: Attachment[];
  onChange: (images: Attachment[]) => void;
}

export function ProductImages({ images, onChange }: ProductImagesProps) {
  const { toast } = useToast();
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleSelect = (selected: Attachment[]) => {
    const existingIds = new Set(images.map((img) => img._id || img.id));
    const newImages = selected.filter(
      (a) => !existingIds.has(a._id) && !existingIds.has(a.id),
    );
    onChange([...images, ...newImages]);
    toast({ title: "Images added", tone: "default" });
  };

  const handleRemove = (idx: number) => {
    const updated = images.filter((_, i) => i !== idx);
    onChange(updated);
  };

  const handleSetCover = (idx: number) => {
    if (idx === 0) return;
    const updated = [...images];
    const [item] = updated.splice(idx, 1);
    updated.unshift(item);
    onChange(updated);
    toast({ title: "Cover image updated", tone: "default" });
  };

  const handleDragStart = (idx: number) => {
    setDraggingIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggingIdx === null || draggingIdx === idx) {
      setDraggingIdx(null);
      setDragOverIdx(null);
      return;
    }
    const updated = [...images];
    const [item] = updated.splice(draggingIdx, 1);
    updated.splice(idx, 0, item);
    onChange(updated);
    setDraggingIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggingIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div className="space-y-3">
      {images.length > 0 ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((img, idx) => (
            <div
              key={img._id || img.id || idx}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-lg border-2 transition",
                idx === 0 ? "border-accent" : "border-border",
                draggingIdx === idx && "opacity-40",
                dragOverIdx === idx &&
                  draggingIdx !== idx &&
                  "ring-2 ring-accent ring-offset-1",
              )}
            >
              {img.type === "image" ? (
                <img
                  src={img.url}
                  alt={img.original_name || img.file_name}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : img.type === "video" || /\.(mp4|mov|webm|avi|mkv)$/i.test(img.file_name ?? "") ? (
                <video
                  src={img.url}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  draggable={false}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-bg-2 text-xs text-fg/50">
                  {img.original_name || img.file_name}
                </div>
              )}

              {idx === 0 && (
                <div className="absolute left-1 top-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-fg shadow">
                  Cover
                </div>
              )}

              <div className="absolute right-1 top-1 cursor-grab opacity-0 transition group-hover:opacity-100">
                <div className="flex h-5 w-5 items-center justify-center rounded bg-black/50">
                  <GripVertical className="h-3 w-3 text-white" />
                </div>
              </div>

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/50 py-1 opacity-0 transition group-hover:opacity-100">
                {idx !== 0 && (
                  <button
                    type="button"
                    title="Set as cover"
                    onClick={() => handleSetCover(idx)}
                    className="flex h-6 w-6 items-center justify-center rounded text-yellow-300 hover:text-yellow-200"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  title="Remove"
                  onClick={() => handleRemove(idx)}
                  className="flex h-6 w-6 items-center justify-center rounded text-red-400 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setGalleryOpen(true)}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-fg/40 transition hover:border-fg/20 hover:text-fg/60"
          >
            <Plus className="h-5 w-5" />
            <span className="text-[10px]">Add</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setGalleryOpen(true)}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border py-10 text-center transition hover:border-fg/20"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-2">
            <Plus className="h-6 w-6 text-fg/40" />
          </div>
          <div>
            <div className="text-sm font-medium text-fg/70">Add images</div>
            <div className="mt-0.5 text-xs text-fg/45">
              Click to open media library
            </div>
          </div>
        </button>
      )}

      {images.length > 0 && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          onClick={() => setGalleryOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Add from library
        </Button>
      )}

      <Gallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={handleSelect}
        isMultiple
        selectedIds={images.map((img) => img._id || img.id)}
      />
    </div>
  );
}
