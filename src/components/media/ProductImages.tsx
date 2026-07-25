import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/utils/cn";
import { useToast } from "@/context";
import { uploadAttachments } from "@/lib/api/products";
import type { Attachment } from "@/types/product";
import { Star, X, Plus, Loader2, Image as ImageIcon, Lightbulb } from "lucide-react";

interface ProductImagesProps {
  images: Attachment[];
  onChange: (images: Attachment[]) => void;
}

const tileBase =
  "group relative cursor-move overflow-hidden rounded-md border border-border bg-bg-2 transition-colors hover:border-accent/50";

// Layout modeled on tenant-dashboard's product media picker: a large cover
// tile plus a mini-grid of the rest, restyled with our own tokens (accent
// instead of primary, warn/danger for the star/remove controls) and wired to
// our real upload-from-device flow rather than a shared media-library modal.
export function ProductImages({ images, onChange }: ProductImagesProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

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

  const handleRemove = (idx: number) => onChange(images.filter((_, i) => i !== idx));

  const handleSetCover = (idx: number) => {
    if (idx === 0) return;
    const updated = [...images];
    const [item] = updated.splice(idx, 1);
    updated.unshift(item);
    onChange(updated);
    toast({ title: "Cover image updated", tone: "default" });
  };

  const handleDragStart = (idx: number) => setDraggingIdx(idx);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (idx: number) => {
    if (draggingIdx === null || draggingIdx === idx) {
      setDraggingIdx(null);
      return;
    }
    const updated = [...images];
    const [item] = updated.splice(draggingIdx, 1);
    updated.splice(idx, 0, item);
    onChange(updated);
    setDraggingIdx(null);
  };

  const imgAlt = (img: Attachment) => img.original_name || img.file_name;

  const AddTile = ({ className }: { className?: string }) => (
    <button
      type="button"
      onClick={openPicker}
      disabled={uploadMutation.isPending}
      title="Add images"
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border bg-bg-2/40 text-fg/40 transition-colors hover:border-accent/40 hover:bg-bg-2 hover:text-fg/60 disabled:opacity-50",
        className,
      )}
    >
      {uploadMutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Plus className="h-4 w-4" />
          <span className="text-[10px] leading-none">Add</span>
        </>
      )}
    </button>
  );

  const CoverPin = () => (
    <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-card ring-1 ring-border">
      <Star className="h-2.5 w-2.5 fill-accent text-accent" />
    </span>
  );

  const StarControl = ({ idx }: { idx: number }) => (
    <button
      type="button"
      onClick={() => handleSetCover(idx)}
      title="Set as cover"
      className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-card opacity-0 ring-1 ring-border transition-opacity group-hover:opacity-100"
    >
      <Star className="h-2.5 w-2.5 text-warn" />
    </button>
  );

  const RemoveControl = ({ idx }: { idx: number }) => (
    <button
      type="button"
      onClick={() => handleRemove(idx)}
      title="Remove"
      className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-card opacity-0 ring-1 ring-border transition-opacity group-hover:opacity-100"
    >
      <X className="h-3 w-3 text-danger" />
    </button>
  );

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

      {images.length === 0 ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={openPicker}
            disabled={uploadMutation.isPending}
            className="flex w-full items-center gap-3 rounded-md border-2 border-dashed border-border bg-bg-2/30 px-4 py-6 text-left transition-colors hover:border-accent/40 hover:bg-bg-2/60 disabled:opacity-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-2">
              {uploadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin text-fg/40" />
              ) : (
                <ImageIcon className="h-4 w-4 text-fg/40" />
              )}
            </span>
            <span>
              <span className="block text-sm font-medium text-fg/75">
                {uploadMutation.isPending ? "Uploading…" : "Click to add images"}
              </span>
              <span className="mt-0.5 block text-xs text-fg/45">
                Drop files here or browse — PNG, JPG up to 5MB
              </span>
            </span>
          </button>

          <div className="flex items-center gap-2 rounded-md border border-warn/30 bg-warn/10 px-3 py-2">
            <Lightbulb className="h-3.5 w-3.5 shrink-0 text-warn" />
            <p className="text-xs text-warn">The first image becomes the cover shown in listings.</p>
          </div>
        </div>
      ) : images.length === 1 ? (
        <div className="flex h-48 gap-2">
          <div
            draggable
            onDragStart={() => handleDragStart(0)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(0)}
            className={cn("flex-1", tileBase)}
          >
            <img src={images[0].url} alt={imgAlt(images[0])} className="h-full w-full object-contain p-1" draggable={false} />
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
              Cover
            </span>
            <CoverPin />
          </div>
          <AddTile className="h-full w-28" />
        </div>
      ) : (
        <div className="flex h-56 gap-2">
          <div
            draggable
            onDragStart={() => handleDragStart(0)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(0)}
            className={cn("h-full w-1/2", tileBase)}
          >
            <img src={images[0].url} alt={imgAlt(images[0])} className="h-full w-full object-contain p-1" draggable={false} />
            <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white">
              Cover
            </span>
            <CoverPin />
          </div>

          <div className="grid h-full w-1/2 auto-rows-[4.5rem] grid-cols-3 content-start gap-2 overflow-y-auto pr-0.5">
            {images.slice(1).map((img, i) => {
              const idx = i + 1;
              return (
                <div
                  key={img._id || img.id || idx}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(idx)}
                  className={tileBase}
                >
                  <img src={img.url} alt={imgAlt(img)} className="h-full w-full object-contain p-1" draggable={false} />
                  <StarControl idx={idx} />
                  <RemoveControl idx={idx} />
                </div>
              );
            })}
            <AddTile className="h-full" />
          </div>
        </div>
      )}

      {images.length > 0 && (
        <p className="text-xs text-fg/40">Drag to reorder, click ★ to set as cover.</p>
      )}
    </div>
  );
}
