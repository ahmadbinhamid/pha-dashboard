import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Monitor, Smartphone } from "lucide-react";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonText } from "@/components/ui/Skeleton";
import { PREVIEW_WIDTHS } from "@/config/emailBuilder";
import type { BeResponse } from "@/lib/api/base";
import { previewCampaign } from "@/lib/api/campaigns";
import type { CampaignPreview, EmailDesign } from "@/types/campaign";

export type PreviewFn = (payload: { design: EmailDesign; subject: string; preheader: string }) => Promise<BeResponse<CampaignPreview>>;

interface EmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  design: EmailDesign;
  subject: string;
  preheader: string;
  // Follow-ups preview through their own endpoint to show the rating stars.
  preview?: PreviewFn;
}

type Device = keyof typeof PREVIEW_WIDTHS;

const DEVICE_OPTIONS = [
  { value: "desktop" as const, label: "Desktop", icon: Monitor },
  { value: "mobile" as const, label: "Phone", icon: Smartphone },
];

export function EmailPreviewModal({ open, onOpenChange, design, subject, preheader, preview = previewCampaign }: EmailPreviewModalProps) {
  const [device, setDevice] = useState<Device>("desktop");
  const mutation = useMutation({ mutationFn: () => preview({ design, subject, preheader }) });
  const { mutate } = mutation;

  useEffect(() => {
    if (open) mutate();
  }, [open, mutate]);

  const result = mutation.data?.data;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-4xl">
        <ModalHeader>
          <ModalTitle>Preview</ModalTitle>
          <ModalDescription>
            Exactly what a subscriber receives, with sample names in the merge tags.
            {result ? <span className="mt-1 block font-medium text-fg">Subject: {result.subject || "(no subject yet)"}</span> : null}
          </ModalDescription>
        </ModalHeader>
        <SegmentedControl options={DEVICE_OPTIONS} value={device} onChange={setDevice} ariaLabel="Device" size="sm" />
        <div className="mt-3 flex max-h-[70vh] justify-center overflow-auto rounded-xl border border-border bg-bg-2 p-3">
          {mutation.isPending ? (
            <div className="w-full p-6">
              <SkeletonText lines={8} />
            </div>
          ) : mutation.isError ? (
            <InlineNotice variant="danger">{(mutation.error as Error).message}</InlineNotice>
          ) : result ? (
            <iframe
              title="Email preview"
              srcDoc={result.html}
              sandbox=""
              className="h-[65vh] rounded-lg border-0 bg-card transition-all"
              style={{ width: PREVIEW_WIDTHS[device] }}
            />
          ) : null}
        </div>
      </ModalContent>
    </Modal>
  );
}
