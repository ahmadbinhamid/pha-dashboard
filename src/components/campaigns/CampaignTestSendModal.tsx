import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { useAuth, useToast } from "@/context";
import { sendTestCampaign } from "@/lib/api/campaigns";

interface CampaignTestSendModalProps {
  campaignId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CampaignTestSendModal({ campaignId, open, onOpenChange }: CampaignTestSendModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (open) setEmail(user?.email ?? "");
  }, [open, user?.email]);

  const mutation = useMutation({
    mutationFn: () => sendTestCampaign(campaignId, email.trim()),
    onSuccess: () => {
      toast({ title: "Test email on its way", description: email, tone: "success" });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: "Couldn't send the test", description: err.message, tone: "danger" }),
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Send a test email</ModalTitle>
          <ModalDescription>Uses the saved version, with sample names in place of merge tags.</ModalDescription>
        </ModalHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <FormField label="Send to" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </FormField>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!email.trim() || mutation.isPending}>
              Send test
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
