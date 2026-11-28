import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { useToast } from "@/context";
import { TEMPLATES_QUERY_KEY, createTemplate } from "@/lib/api/campaigns";
import type { EmailDesign } from "@/types/campaign";

interface SaveTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  design: EmailDesign;
  defaultName: string;
}

export function SaveTemplateModal({ open, onOpenChange, design, defaultName }: SaveTemplateModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  const mutation = useMutation({
    mutationFn: () => createTemplate({ name: name.trim(), design }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY });
      toast({ title: "Template saved", description: "Pick it from Templates on any campaign.", tone: "success" });
      onOpenChange(false);
    },
    onError: (err: Error) => toast({ title: "Couldn't save the template", description: err.message, tone: "danger" }),
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Save as template</ModalTitle>
          <ModalDescription>Keeps this layout so your team can start new campaigns from it.</ModalDescription>
        </ModalHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <FormField label="Template name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={80} />
          </FormField>
          <ModalFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!name.trim() || mutation.isPending}>
              Save template
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
