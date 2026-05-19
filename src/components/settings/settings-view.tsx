
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Image } from "@/components/ui/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrgSettings } from "@/context";
import { useToast } from "@/context";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4">
        <div className="text-xs font-semibold text-fg/70">{label}</div>
        {hint ? <div className="text-xs text-fg/55">{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function SettingsView() {
  const { settings, update, reset } = useOrgSettings();
  const { toast } = useToast();

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader title="Company settings" description="Brand, operations, and default behaviors." />
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Store name" hint="Shown in the sidebar and invoices">
                <Input value={settings.storeName} onChange={(e) => update({ storeName: e.target.value })} />
              </Field>
              <Field label="Location" hint="Shown in the top bar">
                <Input value={settings.location} onChange={(e) => update({ location: e.target.value })} />
              </Field>
              <Field label="Display name" hint="Shown in the user section">
                <Input
                  value={settings.displayName}
                  onChange={(e) => update({ displayName: e.target.value })}
                />
              </Field>
              <Field label="Currency">
                <Input value="AUD" readOnly />
              </Field>
              <Field label="ABN" hint="Shown on invoices">
                <Input value={settings.abn ?? ""} onChange={(e) => update({ abn: e.target.value })} />
              </Field>
              <Field label="Invoice prefix" hint="Used for invoice numbers">
                <Input
                  value={settings.invoicePrefix}
                  onChange={(e) => update({ invoicePrefix: e.target.value.toUpperCase() })}
                />
              </Field>
              <Field label="Next invoice number" hint="Auto-increments on Generate Invoice">
                <Input
                  value={String(settings.nextInvoiceNumber)}
                  onChange={(e) => update({ nextInvoiceNumber: Number(e.target.value || 0) })}
                  inputMode="numeric"
                />
              </Field>
              <Field label="Support email">
                <Input defaultValue="support@partshub.example" />
              </Field>
              <Field label="Time zone">
                <Input defaultValue="Australia/Sydney" />
              </Field>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  reset();
                  toast({ tone: "default", title: "Reset", description: "Company settings reset to defaults." });
                }}
              >
                Reset
              </Button>
              <Button
                onClick={() =>
                  toast({ tone: "success", title: "Saved", description: "Settings stored locally for now." })
                }
              >
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="eBay API settings"
            description="Connect eBay for listing sync, order ingest, and status updates."
            right={<Badge variant="warn">Not connected</Badge>}
          />
          <CardContent className="space-y-4">
            <Field label="App ID" hint="Stored securely server-side in production">
              <Input placeholder="Enter App ID…" />
            </Field>
            <Field label="Cert ID">
              <Input placeholder="Enter Cert ID…" />
            </Field>
            <Field label="Dev ID">
              <Input placeholder="Enter Dev ID…" />
            </Field>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="flex-1"
                onClick={() =>
                  toast({
                    tone: "warning",
                    title: "Coming soon",
                    description: "eBay connection will be backed by API.",
                  })
                }
              >
                Connect eBay
              </Button>
              <Button variant="secondary" className="flex-1">
                Test connection
              </Button>
            </div>
            <div className="rounded-xl border border-border bg-bg-2/30 px-4 py-3 text-sm text-fg/70">
              Once connected, inventory and listing status will sync automatically on schedule.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Notifications" description="Control alerts and reporting." />
          <CardContent className="space-y-3">
            {[
              { label: "Low stock alerts", value: "Enabled" },
              { label: "Daily revenue digest", value: "Enabled" },
              { label: "Sync error notifications", value: "Enabled" },
              { label: "New order push", value: "Muted" },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between rounded-xl border border-border bg-bg px-4 py-3">
                <div className="text-sm font-semibold">{r.label}</div>
                <Badge variant={r.value === "Enabled" ? "ok" : "muted"}>{r.value}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="User management" description="Invite and manage access." />
          <CardContent className="space-y-3">
            {[
              { name: "Avery Chen", role: "Admin", state: "Active" },
              { name: "Jordan Lee", role: "Ops", state: "Active" },
              { name: "Sam Patel", role: "Warehouse", state: "Invited" },
            ].map((u) => (
              <div key={u.name} className="flex items-center justify-between rounded-xl border border-border bg-bg px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{u.name}</div>
                  <div className="truncate text-xs text-fg/60">{u.role}</div>
                </div>
                <Badge variant={u.state === "Active" ? "ok" : "warn"}>{u.state}</Badge>
              </div>
            ))}
            <Button
              className="w-full"
              onClick={() =>
                toast({ tone: "default", title: "Invite sent", description: "Demo action (no backend yet)." })
              }
            >
              Invite user
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Branding" description="Logo and brand identity." />
          <CardContent className="space-y-3">
            <div className="rounded-xl border border-border bg-bg-2/30 px-4 py-3 text-sm text-fg/70">
              Upload a store logo (stored locally for now; in production this lives in your backend).
            </div>
            <input
              type="file"
              accept="image/*"
              className="block w-full text-sm text-fg/70 file:mr-3 file:rounded-lg file:border-0 file:bg-bg-2 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-fg hover:file:bg-bg-2/70"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  update({ logoDataUrl: String(reader.result) });
                  toast({ tone: "success", title: "Logo updated", description: "Saved locally for now." });
                };
                reader.readAsDataURL(file);
              }}
            />
            {settings.logoDataUrl ? (
              <div className="rounded-xl border border-border bg-bg p-3">
                <Image src={settings.logoDataUrl} alt="Store logo" className="h-12 w-auto rounded-md" />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

