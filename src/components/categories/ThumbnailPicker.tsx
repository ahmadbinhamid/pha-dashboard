import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/context";
import { uploadAttachments } from "@/lib/api/products";
import type { Attachment } from "@/types/product";
import { Image as ImageIcon, X, Loader2 } from "lucide-react";

export function ThumbnailPicker({
  value,
  onChange,
}: {
  value: Attachment | null;
  onChange: (attachment: Attachment | null) => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAttachments([file]),
    onSuccess: (res) => {
      const uploaded = res.data?.[0];
      if (uploaded) onChange(uploaded);
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, tone: "danger" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xs border border-border bg-bg-2">
        {uploadMutation.isPending ? (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-fg/40" />
          </div>
        ) : value?.url ? (
          <img src={value.url} alt="Thumbnail" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-6 w-6 text-fg/25" />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploadMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          {value ? "Replace image" : "Upload image"}
        </Button>
        {value && (
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-fg/50 hover:text-danger"
            onClick={() => onChange(null)}
          >
            <X className="h-3 w-3" />
            Remove
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
