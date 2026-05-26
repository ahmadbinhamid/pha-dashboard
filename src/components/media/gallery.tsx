import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { uploadAttachments, getAttachments } from "@/lib/api/products";
import type { Attachment } from "@/types/product";
import { Check, Upload, X, Image as ImageIcon, FileIcon } from "lucide-react";

interface GalleryProps {
  open: boolean;
  onClose: () => void;
  onSelect: (images: Attachment[]) => void;
  isMultiple?: boolean;
  selectedIds?: string[];
}

function AttachmentThumbnail({
  attachment,
  selected,
  onClick,
}: {
  attachment: Attachment;
  selected: boolean;
  onClick: () => void;
}) {
  const isImage = attachment.type === "image";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative aspect-square overflow-hidden rounded-lg border-2 transition",
        selected
          ? "border-accent shadow-md"
          : "border-border hover:border-fg/30",
      )}
    >
      {isImage ? (
        <img
          src={attachment.url}
          alt={attachment.original_name || attachment.file_name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-bg-2">
          <FileIcon className="h-8 w-8 text-fg/40" />
        </div>
      )}

      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition",
          selected ? "bg-accent/20" : "bg-transparent group-hover:bg-black/10",
        )}
      >
        {selected && (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-fg shadow">
            <Check className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
        {attachment.original_name || attachment.file_name}
      </div>
    </button>
  );
}

export function Gallery({
  open,
  onClose,
  onSelect,
  isMultiple = false,
  selectedIds = [],
}: GalleryProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setSelected(new Set(selectedIds));
  }, [open, selectedIds.join(",")]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const { data, isLoading } = useQuery({
    queryKey: ["attachments", "gallery"],
    queryFn: () => getAttachments({ limit: 100 }),
    enabled: open,
  });

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => uploadAttachments(files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attachments"] });
    },
  });

  const attachments: Attachment[] = data?.data?.items ?? [];

  const toggleItem = (attachment: Attachment) => {
    const id = attachment._id || attachment.id;
    if (isMultiple) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    } else {
      setSelected(new Set([id]));
    }
  };

  const handleDone = () => {
    const selectedItems = attachments.filter(
      (a) => selected.has(a._id) || selected.has(a.id),
    );
    onSelect(selectedItems);
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    await uploadMutation.mutateAsync(files);
    e.target.value = "";
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 flex h-[85dvh] w-[min(95vw,860px)] flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-sm font-semibold">Media Library</div>
            <div className="mt-0.5 text-xs text-fg/60">
              {isMultiple ? "Select one or more files" : "Select a file"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadMutation.isPending ? "Uploading..." : "Upload"}
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-fg/60 hover:bg-bg-2 hover:text-fg"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.zip"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-fg/50">
              Loading media...
            </div>
          ) : attachments.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-2">
                <ImageIcon className="h-8 w-8 text-fg/30" />
              </div>
              <div>
                <div className="text-sm font-medium">No media yet</div>
                <div className="mt-1 text-xs text-fg/50">
                  Upload files using the button above
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {attachments.map((attachment) => (
                <AttachmentThumbnail
                  key={attachment._id || attachment.id}
                  attachment={attachment}
                  selected={
                    selected.has(attachment._id) || selected.has(attachment.id)
                  }
                  onClick={() => toggleItem(attachment)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-between border-t border-border bg-bg-2/50 px-5 py-3">
          <div className="text-xs text-fg/60">
            {selected.size > 0
              ? `${selected.size} file${selected.size !== 1 ? "s" : ""} selected`
              : "No files selected"}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={selected.size === 0}
              onClick={handleDone}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
