import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/context";
import {
  getInventorySettings,
  updateInventorySettings,
} from "@/lib/api/inventory";
import type { InventorySettings } from "@/types/inventory";

export default function InventorySettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["inventory-settings"],
    queryFn: getInventorySettings,
  });

  const settings = data?.data;

  const [form, setForm] = useState<Partial<InventorySettings>>({});

  useEffect(() => {
    if (settings) {
      setForm({
        low_stock_threshold: settings.low_stock_threshold,
        email_notifications: settings.email_notifications,
        notification_email: settings.notification_email ?? "",
        notification_send_time: settings.notification_send_time,
      });
    }
  }, [settings?._id]);

  const mutation = useMutation({
    mutationFn: (payload: Partial<InventorySettings>) =>
      updateInventorySettings(payload),
    onSuccess: () => {
      toast({ title: "Settings saved", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["inventory-settings"] });
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, tone: "danger" });
    },
  });

  const set = <K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      low_stock_threshold: Number(form.low_stock_threshold ?? 10),
      email_notifications: form.email_notifications ?? false,
      notification_email: form.notification_email || null,
      notification_send_time: form.notification_send_time ?? "09:00",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-fg/50">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Inventory Settings
        </h1>
        <p className="mt-1 text-sm text-fg/60">
          Configure stock thresholds and notification preferences.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader
            title="Stock Thresholds"
            description="Define when a product is considered low on stock"
          />
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-fg/70">
                Low Stock Threshold
              </label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min="0"
                  value={form.low_stock_threshold ?? 10}
                  onChange={(e) =>
                    set("low_stock_threshold", parseInt(e.target.value, 10))
                  }
                  className="max-w-[120px]"
                />
                <span className="text-sm text-fg/60">units</span>
              </div>
              <p className="mt-1.5 text-xs text-fg/45">
                Products at or below this count will be flagged as low stock.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Email Notifications"
            description="Receive daily low-stock alerts via email"
          />
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-fg/80">
              <input
                type="checkbox"
                checked={form.email_notifications ?? false}
                onChange={(e) => set("email_notifications", e.target.checked)}
                className="h-4 w-4 rounded border-border accent-accent"
              />
              Enable email notifications
            </label>

            {form.email_notifications && (
              <>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-fg/70">
                    Notification Email
                  </label>
                  <Input
                    type="email"
                    value={form.notification_email ?? ""}
                    onChange={(e) => set("notification_email", e.target.value)}
                    placeholder="alerts@example.com"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-fg/70">
                    Send Time (daily)
                  </label>
                  <Input
                    type="time"
                    value={form.notification_send_time ?? "09:00"}
                    onChange={(e) =>
                      set("notification_send_time", e.target.value)
                    }
                    className="max-w-[140px]"
                  />
                  <p className="mt-1.5 text-xs text-fg/45">
                    Time is in server local time.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={mutation.isPending}
          className="w-full"
        >
          {mutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </div>
  );
}
