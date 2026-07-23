import { AlertTriangle, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import { useToast } from "@/context";
import { deleteCustomer } from "@/lib/api/customers";
import type { Customer } from "@/types/customer";

interface CustomerDeleteModalProps {
  customer: Customer | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function CustomerDeleteModal({ customer, onOpenChange, onDeleted }: CustomerDeleteModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      toast({ title: "Customer deleted", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onOpenChange(false);
      onDeleted?.();
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, tone: "danger" });
      onOpenChange(false);
    },
  });

  return (
    <Modal
      open={!!customer}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      {customer && (
        <ModalContent className="max-w-sm">
          <ModalHeader>
            <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-danger/10">
              <AlertTriangle className="h-5 w-5 text-danger" />
            </div>
            <ModalTitle>Delete customer?</ModalTitle>
            <ModalDescription>
              <span className="font-medium text-fg">{customer.name}</span> will be permanently deleted. This
              action cannot be undone.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={deleteMutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="md"
              className="flex-1 gap-2"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(customer._id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </ModalFooter>
        </ModalContent>
      )}
    </Modal>
  );
}
