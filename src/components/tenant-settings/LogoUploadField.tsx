import { useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, X, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { useToast } from "@/context";
import { uploadAttachments } from "@/lib/api/products";

export function LogoUploadField({
  shape = "circle",
  title,
  bullets,
  value,
  onChange,
  onRemove,
}: {
  shape?: "circle" | "square";
  title: string;
  bullets: string[];
  value: string | null;
  onChange: (url: string) => void;
  onRemove?: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAttachments([file]),
    onSuccess: (res) => {
      const uploaded = res.data?.[0];
      if (uploaded) onChange(uploaded.url);
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
    <div className="flex items-start gap-4">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploadMutation.isPending}
        title={`Upload ${title.toLowerCase()}`}
        className={cn(
          "flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border-2 border-dashed border-border bg-bg-2/40 text-fg/40 transition-colors hover:border-accent/40 hover:bg-bg-2 hover:text-fg/60 disabled:opacity-50",
          shape === "circle" ? "rounded-full" : "rounded-md",
        )}
      >
        {uploadMutation.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : value ? (
          <img src={value} alt={title} className="h-full w-full object-cover" />
        ) : (
          <Upload className="h-5 w-5" />
        )}
      </button>

      <div className="min-w-0 flex-1 pt-1">
        <p className="text-sm font-semibold text-fg">{title}</p>
        <ul className="mt-1.5 space-y-1 text-xs text-fg/55">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-1.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-fg/35" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
        {value && onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-danger hover:underline"
          >
            <X className="h-3 w-3" />
            Remove {title.toLowerCase()}
          </button>
        ) : null}
      </div>
    </div>
  );
}
