import { AlertTriangle } from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { ButtonVariant } from "@/components/ui/buttonStyles";

type ConfirmTone = "danger" | "warn" | "accent";

const TONE_ICON_BG: Record<ConfirmTone, string> = {
  danger: "bg-danger/10",
  warn: "bg-warn/10",
  accent: "bg-accent/10",
};

const TONE_ICON_FG: Record<ConfirmTone, string> = {
  danger: "text-danger",
  warn: "text-warn",
  accent: "text-accent",
};

const TONE_CONFIRM_VARIANT: Record<ConfirmTone, ButtonVariant> = {
  danger: "danger",
  warn: "primary",
  accent: "primary",
};

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  confirming?: boolean;
}

// Generic yes/no confirmation dialog — the one place in the app that stands
// in for window.confirm()/alert(). Native browser dialogs can't be themed,
// block the JS thread, and read as a bug on a dashboard this polished, so
// this is what every "are you sure?" prompt should reach for instead. A
// dialog that needs its own inputs or a more complex body (e.g. a delete
// confirmation with a "this is still listed elsewhere" branch) still gets
// its own one-off Modal — this is only for the plain confirm/cancel case.
export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "accent",
  onConfirm,
  confirming = false,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-sm">
        <ModalHeader>
          <div className={`mb-1 flex h-11 w-11 items-center justify-center rounded-full ${TONE_ICON_BG[tone]}`}>
            <AlertTriangle className={`h-5 w-5 ${TONE_ICON_FG[tone]}`} />
          </div>
          <ModalTitle>{title}</ModalTitle>
          {description && <ModalDescription>{description}</ModalDescription>}
        </ModalHeader>
        <ModalFooter>
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="flex-1"
            disabled={confirming}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={TONE_CONFIRM_VARIANT[tone]}
            size="md"
            className="flex-1"
            disabled={confirming}
            onClick={onConfirm}
          >
            {confirming ? "Please wait…" : confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
