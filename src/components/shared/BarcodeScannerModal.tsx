import { useRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";

interface BarcodeScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetect: (value: string) => void;
  title: string;
  description: string;
}

// Camera preview with an aiming frame; closes itself on the first read.
export function BarcodeScannerModal({ open, onOpenChange, onDetect, title, description }: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { error, starting } = useBarcodeScanner({
    active: open,
    videoRef,
    onDetect: (value) => {
      onOpenChange(false);
      onDetect(value);
    },
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          <ModalDescription>{description}</ModalDescription>
        </ModalHeader>

        {/* Camera feed: black backdrop and white frame as with other overlays. */}
        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          {error ? (
            <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">{error}</p>
          ) : (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {starting ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              ) : (
                <div className="h-3/5 w-3/5 rounded-2xl border-2 border-white/80" />
              )}
            </div>
          )}
        </div>

        <ModalFooter>
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
