import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { FormField } from "@/components/ui/FormField";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";

interface CampaignScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue: string | null;
  scheduling: boolean;
  onSchedule: (iso: string) => void;
}

export function CampaignScheduleModal({ open, onOpenChange, initialValue, scheduling, onSchedule }: CampaignScheduleModalProps) {
  const [value, setValue] = useState<string | null>(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  const inFuture = !!value && new Date(value) > new Date();

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Schedule send</ModalTitle>
          <ModalDescription>It goes to everyone in the audience who is still subscribed at that time.</ModalDescription>
        </ModalHeader>
        <FormField label="Send at" error={value && !inFuture ? "Pick a time in the future" : undefined}>
          <DateTimePicker value={value} onChange={setValue} minDate={new Date()} defaultTime="09:00" placeholder="Pick a date" />
        </FormField>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="primary" disabled={!inFuture || scheduling} onClick={() => value && onSchedule(value)}>
            Schedule
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
