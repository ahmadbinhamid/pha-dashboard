import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Switch } from "@/components/ui/Switch";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";
import { useToast } from "@/context";
import { getInventorySettings, updateInventorySettings } from "@/lib/api/inventory";

interface InventorySettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InventorySettingsModal({ open, onOpenChange }: InventorySettingsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["inventory-settings"],
    queryFn: getInventorySettings,
    enabled: open,
  });
  const settings = data?.data;

  const [threshold, setThreshold] = useState("10");
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [sendTime, setSendTime] = useState("22:00");

  useEffect(() => {
    if (settings) {
      setThreshold(String(settings.low_stock_threshold));
      setEmailEnabled(settings.email_notifications);
      setEmail(settings.notification_email ?? "");
      setSendTime(settings.notification_send_time || "22:00");
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: () =>
      updateInventorySettings({
        low_stock_threshold: Number(threshold) || 0,
        email_notifications: emailEnabled,
        notification_email: email || null,
        notification_send_time: sendTime,
      }),
    onSuccess: () => {
      toast({ title: "Inventory settings saved", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["inventory-settings"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't save settings", description: err.message, tone: "danger" });
    },
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        <ModalHeader>
          <ModalTitle>Inventory Settings</ModalTitle>
          <ModalDescription>Configure stock tracking preferences like low-stock thresholds</ModalDescription>
        </ModalHeader>

        <div className="space-y-4">
          <FormField
            label="Low Stock Threshold"
            hint="Alert when a variant's stock falls at or below this number."
          >
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="max-w-32"
              />
              <span className="text-sm text-fg/50">units</span>
            </div>
          </FormField>

          <Switch
            checked={emailEnabled}
            onCheckedChange={setEmailEnabled}
            label="Email Notifications"
            description={emailEnabled ? "Low stock alerts are active" : "Low stock alerts are off"}
          />

          <FormField label="Recipient Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </FormField>

          <FormField label="Send Time" hint="Daily time to send the low stock digest.">
            <Input
              type="time"
              value={sendTime}
              onChange={(e) => setSendTime(e.target.value)}
              className="max-w-40"
            />
          </FormField>
        </div>

        <ModalFooter>
          <Button type="button" variant="secondary" size="md" disabled={mutation.isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="primary" size="md" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
