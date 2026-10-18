import { Loader2, Upload } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { useImageUpload } from "@/hooks/useImageUpload";

interface ImageUploadButtonProps extends Pick<ButtonProps, "variant" | "size" | "className" | "disabled"> {
  onUploaded: (url: string) => void;
  maxBytes?: number;
  label?: string;
}

/** Button that picks one image, uploads it and returns its URL. */
export function ImageUploadButton({ onUploaded, maxBytes, label = "Upload", variant = "secondary", size, className, disabled }: ImageUploadButtonProps) {
  const upload = useImageUpload({ onUploaded, maxBytes });
  return (
    <>
      <input {...upload.inputProps} />
      <Button type="button" variant={variant} size={size} className={className} disabled={disabled || upload.isUploading} onClick={upload.open}>
        {upload.isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {upload.isUploading ? "Uploading…" : label}
      </Button>
    </>
  );
}
