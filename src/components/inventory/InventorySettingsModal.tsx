import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { Switch } from "@/components/ui/Switch";
import { DIGEST_FREQUENCY_OPTIONS, DIGEST_MONTH_DAY_OPTIONS, DIGEST_WEEKDAY_OPTIONS } from "@/config/inventoryDigest";
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
import { inventorySettingsFormSchema, type InventorySettingsFormValues } from "@/lib/validation/inventorySettings";
import { utcTimeToSydney, sydneyTimeToUtc } from "@/utils/timezone";

interface InventorySettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_FORM: InventorySettingsFormValues = {
  threshold: "10",
  emailEnabled: false,
  email: "",
  sendTime: "22:00",
  frequency: "daily",
  weekday: "1",
  monthDay: "1",
};

const SCHEDULE_HINT: Record<InventorySettingsFormValues["frequency"], string> = {
  daily: "Sent every day at this time (Sydney).",
  weekly: "Sent once a week on this day and time (Sydney).",
  monthly: "Sent once a month on this day and time (Sydney).",
};

export function InventorySettingsModal({ open, onOpenChange }: InventorySettingsModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["inventory-settings"],
    queryFn: getInventorySettings,
    enabled: open,
  });
  const settings = data?.data;

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
  } = useForm<InventorySettingsFormValues>({
    resolver: zodResolver(inventorySettingsFormSchema),
    defaultValues: DEFAULT_FORM,
  });

  useEffect(() => {
    if (settings) {
      reset({
        threshold: String(settings.low_stock_threshold),
        emailEnabled: settings.email_notifications,
        email: settings.notification_email ?? "",
        // Stored as UTC; edited here in Sydney time (see utils/timezone.ts).
        sendTime: utcTimeToSydney(settings.notification_send_time || "22:00"),
        frequency: settings.notification_frequency ?? "daily",
        weekday: String(settings.notification_weekday ?? 1),
        monthDay: String(settings.notification_month_day ?? 1),
      });
    }
  }, [settings, reset]);

  const mutation = useMutation({
    mutationFn: (values: InventorySettingsFormValues) =>
      updateInventorySettings({
        low_stock_threshold: Number(values.threshold) || 0,
        email_notifications: values.emailEnabled,
        notification_email: values.email || null,
        notification_send_time: sydneyTimeToUtc(values.sendTime),
        notification_frequency: values.frequency,
        notification_weekday: Number(values.weekday),
        notification_month_day: Number(values.monthDay),
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

  const onSubmit = (values: InventorySettingsFormValues) => mutation.mutate(values);
  const frequency = watch("frequency");

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        <form onSubmit={handleSubmit(onSubmit)}>
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
                <Input type="number" min="0" className="max-w-32" {...register("threshold")} />
                <span className="text-sm text-fg/50">units</span>
              </div>
            </FormField>

            <Controller
              control={control}
              name="emailEnabled"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  label="Email Notifications"
                  description={field.value ? "Low stock alerts are active" : "Low stock alerts are off"}
                />
              )}
            />

            <FormField label="Recipient Email">
              <Input type="email" placeholder="you@example.com" {...register("email")} />
            </FormField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <FormField label="Frequency">
                <Controller
                  control={control}
                  name="frequency"
                  render={({ field }) => <SingleSelect options={DIGEST_FREQUENCY_OPTIONS} value={field.value} onChange={field.onChange} />}
                />
              </FormField>
              {frequency === "weekly" && (
                <FormField label="Day">
                  <Controller
                    control={control}
                    name="weekday"
                    render={({ field }) => <SingleSelect options={DIGEST_WEEKDAY_OPTIONS} value={field.value} onChange={field.onChange} />}
                  />
                </FormField>
              )}
              {frequency === "monthly" && (
                <FormField label="Day of month">
                  <Controller
                    control={control}
                    name="monthDay"
                    render={({ field }) => <SingleSelect options={DIGEST_MONTH_DAY_OPTIONS} value={field.value} onChange={field.onChange} />}
                  />
                </FormField>
              )}
              <FormField label="Send time">
                <Input type="time" {...register("sendTime")} />
              </FormField>
            </div>
            <p className="-mt-2 text-xs text-fg/55">{SCHEDULE_HINT[frequency]}</p>
          </div>

          <ModalFooter>
            <Button type="button" variant="secondary" size="md" disabled={mutation.isPending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
