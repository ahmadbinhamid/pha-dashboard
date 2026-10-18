import { useState } from "react";
import { Modal, ModalContent, ModalDescription, ModalTitle } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StorefrontSimulator } from "@/components/storefront/StorefrontSimulator";
import { SIMULATOR_DEVICES } from "@/config/storefront";
import type { Category, Product } from "@/types/product";
import type { SimulatorDevice, StorefrontPreviewContent } from "@/types/storefront";

interface StorefrontPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: StorefrontPreviewContent;
  storeName: string;
  logoUrl: string | null;
  host: string;
  categories: Category[];
  products: Product[];
}

export function StorefrontPreviewDialog({ open, onOpenChange, ...storefront }: StorefrontPreviewDialogProps) {
  const [device, setDevice] = useState<SimulatorDevice>("desktop");
  const spec = SIMULATOR_DEVICES.find((d) => d.value === device) ?? SIMULATOR_DEVICES[0];

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="flex h-[92dvh] max-w-[min(96vw,1440px)] flex-col gap-0 p-0">
        <div className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-3 pr-14">
          <div className="min-w-0 flex-1">
            <ModalTitle>Storefront preview</ModalTitle>
            <ModalDescription className="mt-1 text-xs">
              {spec.label} · {spec.width}px · includes unsaved changes
            </ModalDescription>
          </div>
          <SegmentedControl options={SIMULATOR_DEVICES} value={device} onChange={setDevice} ariaLabel="Preview device" size="sm" />
        </div>
        <StorefrontSimulator device={device} {...storefront} className="flex-1 rounded-b-2xl bg-bg-2/60" />
      </ModalContent>
    </Modal>
  );
}
