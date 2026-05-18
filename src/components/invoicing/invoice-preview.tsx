"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { InvoiceDraft } from "@/lib/invoicing/types";
import { splitGstIncluded } from "@/lib/invoicing/math";
import { useOrgSettings } from "@/components/settings/org-settings-provider";

function StatusBadge({ status }: { status: InvoiceDraft["status"] }) {
  switch (status) {
    case "draft":
      return <Badge variant="outline">Draft</Badge>;
    case "pending":
      return <Badge variant="warn">Pending</Badge>;
    case "paid":
      return <Badge variant="ok">Paid</Badge>;
    case "refunded":
      return <Badge variant="muted">Refunded</Badge>;
  }
}

export function InvoicePreview({ draft, mode }: { draft: InvoiceDraft; mode?: "panel" | "print" }) {
  const { settings } = useOrgSettings();
  const isPrint = mode === "print";

  const linesTotal = draft.lines.reduce((a, l) => a + l.unitPriceInclGst * l.qty, 0);
  const totalInclGst = Math.max(0, linesTotal + draft.shippingInclGst - draft.discountInclGst);
  const { subtotal, gst, total } = splitGstIncluded(totalInclGst);

  return (
    <Card className={isPrint ? "shadow-none ring-0" : ""}>
      <CardHeader
        title={
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate">Invoice</div>
              <div className="mt-1 text-xs text-fg/60">#{draft.invoiceNumber}</div>
            </div>
            <StatusBadge status={draft.status} />
          </div>
        }
        description={isPrint ? undefined : "GST included (AU). Subtotal and GST breakdown shown below."}
      />
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{settings.storeName}</div>
            <div className="mt-1 text-xs text-fg/60">{settings.location}</div>
            {settings.abn ? <div className="mt-1 text-xs text-fg/60">ABN {settings.abn}</div> : null}
          </div>
          {settings.logoDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoDataUrl} alt="Store logo" className="h-10 w-auto rounded-md" />
          ) : (
            <Badge variant="outline">AUD</Badge>
          )}
        </div>

        <div className="rounded-xl border border-border bg-bg-2/30 p-4">
          <div className="text-xs font-semibold text-fg/60">Bill to</div>
          {draft.customer ? (
            <>
              <div className="mt-1 text-sm font-semibold">{draft.customer.name}</div>
              {draft.customer.email ? <div className="text-xs text-fg/60">{draft.customer.email}</div> : null}
              {draft.customer.phone ? <div className="text-xs text-fg/60">{draft.customer.phone}</div> : null}
              {draft.customerAddress ? <div className="mt-1 text-xs text-fg/60">{draft.customerAddress}</div> : null}
            </>
          ) : (
            <div className="mt-1 text-sm text-fg/65">Add customer details</div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-bg px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-fg/55">Sale type</div>
            <div className="mt-1 text-sm font-semibold text-fg">{(draft.saleType ?? "walk_in").replaceAll("_", " ")}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-fg/55">Fulfilment</div>
            <div className="mt-1 text-sm font-semibold text-fg">{draft.fulfilment ?? "pickup"}</div>
          </div>
          <div className="rounded-xl border border-border bg-bg px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-fg/55">Payment</div>
            <div className="mt-1 text-sm font-semibold text-fg">{draft.paymentMethod.replaceAll("_", " ")}</div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border">
          <div className="bg-bg-2/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-fg/55">
            Items
          </div>
          <div className="divide-y divide-border bg-bg">
            {draft.lines.length ? (
              draft.lines.map((l) => (
                <div key={l.productId} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{l.title}</div>
                    <div className="truncate text-xs text-fg/60">{l.sku}</div>
                    <div className="mt-1 text-xs text-fg/60">Qty {l.qty}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">
                      {formatCurrency(l.unitPriceInclGst * l.qty, "AUD")}
                    </div>
                    <div className="text-xs text-fg/60">
                      {formatCurrency(l.unitPriceInclGst, "AUD")} ea (inc. GST)
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-fg/60">
                Add products to see invoice items.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-bg px-4 py-3">
          <div className="flex items-center justify-between py-1 text-sm">
            <div className="text-fg/70">Subtotal (ex GST)</div>
            <div className="font-semibold">{formatCurrency(subtotal, "AUD")}</div>
          </div>
          <div className="flex items-center justify-between py-1 text-sm">
            <div className="text-fg/70">GST (10%)</div>
            <div className="font-semibold">{formatCurrency(gst, "AUD")}</div>
          </div>
          <div className="my-2 h-px bg-border" />
          <div className="flex items-center justify-between py-1 text-sm">
            <div className="text-fg/70">Total (inc GST)</div>
            <div className="text-base font-semibold">{formatCurrency(total, "AUD")}</div>
          </div>
        </div>

        {draft.activity.length ? (
          <div className="rounded-xl border border-border bg-bg-2/30 p-4">
            <div className="text-xs font-semibold text-fg/60">Timeline</div>
            <div className="mt-3 space-y-2">
              {draft.activity.slice().reverse().map((a, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent/80" />
                  <div className="min-w-0">
                    <div className="text-sm text-fg/80">{a.text}</div>
                    <div className="mt-1 text-xs text-fg/55">{a.at}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

