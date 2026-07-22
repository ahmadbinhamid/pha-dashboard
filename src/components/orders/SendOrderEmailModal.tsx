import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import { useToast } from "@/context";
import { sendOrderEmail } from "@/lib/api/orders";
import type { OrderDetail } from "@/types/orders";

interface SendOrderEmailModalProps {
  order: OrderDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMPTY_FORM = { tracking_number: "", carrier_name: "" };

export function SendOrderEmailModal({ order, open, onOpenChange }: SendOrderEmailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isDelivery = order.delivery_method === "delivery";

  const mutation = useMutation({
    mutationFn: () =>
      sendOrderEmail(order._id, isDelivery ? { tracking_number: form.tracking_number, carrier_name: form.carrier_name } : {}),
    onSuccess: () => {
      toast({
        title: isDelivery ? "Shipment email sent" : "Invoice email sent",
        description: `Notified ${order.customer.email}.`,
        tone: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["order", order._id] });
      setForm(EMPTY_FORM);
      setErrors({});
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Could not send email", description: err.message, tone: "danger" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isDelivery) {
      const nextErrors: Record<string, string> = {};
      if (!form.tracking_number.trim()) nextErrors.tracking_number = "Tracking number is required";
      if (!form.carrier_name.trim()) nextErrors.carrier_name = "Carrier name is required";
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        return;
      }
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setForm(EMPTY_FORM);
          setErrors({});
        }
        onOpenChange(next);
      }}
    >
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader>
            <ModalTitle>{isDelivery ? "Mark as shipped" : "Send invoice email"}</ModalTitle>
            <ModalDescription>
              {isDelivery
                ? `Enter the carrier and tracking number — this marks the order fulfilled and emails ${order.customer.email} with tracking details.`
                : `This will email the tax invoice (PDF attached) to ${order.customer.email}.`}
            </ModalDescription>
          </ModalHeader>

          {isDelivery && (
            <div className="space-y-4">
              <FormField label="Carrier Name" required error={errors.carrier_name}>
                <Input
                  value={form.carrier_name}
                  onChange={(e) => setForm((f) => ({ ...f, carrier_name: e.target.value }))}
                  placeholder="e.g. Australia Post"
                  autoFocus
                />
              </FormField>
              <FormField label="Tracking Number" required error={errors.tracking_number}>
                <Input
                  value={form.tracking_number}
                  onChange={(e) => setForm((f) => ({ ...f, tracking_number: e.target.value }))}
                  placeholder="e.g. 1234567890AU"
                />
              </FormField>
            </div>
          )}

          <ModalFooter>
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="flex-1"
              disabled={mutation.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" className="flex-1 gap-2" disabled={mutation.isPending}>
              <Mail className="h-4 w-4" />
              {mutation.isPending ? "Sending…" : "Send Email"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
