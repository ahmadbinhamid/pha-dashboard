import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/context";
import { uploadAttachments } from "@/lib/api/products";
import { formatBytes } from "@/utils/format";

interface UseImageUploadOptions {
  onUploaded: (url: string) => void;
  // Rejected before uploading, the server enforces its own limit too.
  maxBytes?: number;
}

/** One-image upload via a hidden file input, spread inputProps on <input>. */
export function useImageUpload({ onUploaded, maxBytes }: UseImageUploadOptions) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: (file: File) => uploadAttachments([file]),
    onSuccess: (res) => {
      const uploaded = res.data?.[0];
      if (uploaded) onUploaded(uploaded.url);
    },
    onError: (err: Error) => toast({ title: "Upload failed", description: err.message, tone: "danger" }),
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Pick an image file", tone: "danger" });
      return;
    }
    if (maxBytes && file.size > maxBytes) {
      toast({ title: "Image too large", description: `Keep it under ${formatBytes(maxBytes)}.`, tone: "danger" });
      return;
    }
    mutation.mutate(file);
  }

  return {
    open: () => inputRef.current?.click(),
    isUploading: mutation.isPending,
    inputProps: { ref: inputRef, type: "file" as const, accept: "image/*", className: "hidden", onChange: handleChange },
  };
}
