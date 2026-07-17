import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/utils/cn";
import { useToast } from "@/context";
import { uploadAttachments } from "@/lib/api/products";
import type { Attachment } from "@/types/product";
import { Star, Trash2, GripVertical, Plus, Loader2 } from "lucide-react";

interface ProductImagesProps {
  images: Attachment[];
  onChange: (images: Attachment[]) => void;
}

export function ProductImages({ images, onChange }: ProductImagesProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => uploadAttachments(files),
    onSuccess: (res) => {
      const uploaded: Attachment[] = res.data ?? [];
      onChange([...images, ...uploaded]);
      queryClient.invalidateQueries({ queryKey: ["attachments"] });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, tone: "danger" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    uploadMutation.mutate(files);
    e.target.value = "";
  };

  const openPicker = () => fileInputRef.current?.click();

  const handleRemove = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  const handleSetCover = (idx: number) => {
    if (idx === 0) return;
    const updated = [...images];
    const [item] = updated.splice(idx, 1);
    updated.unshift(item);
    onChange(updated);
    toast({ title: "Cover image updated", tone: "default" });
  };

  const handleDragStart = (idx: number) => setDraggingIdx(idx);

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
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

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
                dragOverIdx === idx && draggingIdx !== idx && "ring-2 ring-accent ring-offset-1",
              )}
            >
              <img
                src={img.url}
                alt={img.original_name || img.file_name}
                className="h-full w-full object-cover"
                draggable={false}
              />

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
            onClick={openPicker}
            disabled={uploadMutation.isPending}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-fg/40 transition hover:border-fg/20 hover:text-fg/60 disabled:opacity-50"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Plus className="h-5 w-5" />
                <span className="text-[10px]">Add</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={uploadMutation.isPending}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border py-10 text-center transition hover:border-fg/20 disabled:opacity-50"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-2">
            {uploadMutation.isPending ? (
              <Loader2 className="h-6 w-6 animate-spin text-fg/40" />
            ) : (
              <Plus className="h-6 w-6 text-fg/40" />
            )}
          </div>
          <div>
            <div className="text-sm font-medium text-fg/70">
              {uploadMutation.isPending ? "Uploading…" : "Add images"}
            </div>
            <div className="mt-0.5 text-xs text-fg/45">
              Click to upload from your device
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
