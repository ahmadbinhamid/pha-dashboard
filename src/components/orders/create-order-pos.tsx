"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icons } from "@/components/ui/icons";
import { useToast } from "@/components/toast/toast-provider";
import { useInventoryData, useInventoryActions } from "@/components/inventory/inventory-store";
import { CUSTOMERS } from "@/lib/data/customers";
import type { Customer, FulfilmentType, InvoiceDraft, InvoiceLine, PaymentMethod, SaleType } from "@/lib/invoicing/types";
import { InvoicePreview } from "@/components/invoicing/invoice-preview";
import { splitGstIncluded } from "@/lib/invoicing/math";
import { formatCurrency } from "@/lib/format";
import { useOrgSettings } from "@/components/settings/org-settings-provider";
import { useOrders } from "@/components/orders/orders-store";

const DRAFT_KEY = "ppg-order-draft";

function nowStamp() {
  const d = new Date();
  return d.toLocaleString("en-AU", { hour12: true });
}

function clampInt(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function nextInvoiceNumber(prefix: string, n: number) {
  return `${prefix}-${String(n).padStart(5, "0")}`;
}

export function CreateOrderPos() {
  const router = useRouter();
  const { toast } = useToast();
  const { items: inventory } = useInventoryData();
  const { deductStock } = useInventoryActions();
  const { settings, update } = useOrgSettings();
  const { appendOrder } = useOrders();

  const [productQuery, setProductQuery] = useState("");

  const [customerQuery, setCustomerQuery] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [saleType, setSaleType] = useState<SaleType>("walk_in");
  const [fulfilment, setFulfilment] = useState<FulfilmentType>("pickup");

  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [shippingInclGst, setShippingInclGst] = useState(0);
  const [discountInclGst, setDiscountInclGst] = useState(0);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("eftpos");
  const [status, setStatus] = useState<InvoiceDraft["status"]>("draft");

  const [activity, setActivity] = useState<Array<{ at: string; text: string }>>([
    { at: nowStamp(), text: "Draft created." },
  ]);

  const invoiceNumber = useMemo(
    () => nextInvoiceNumber(settings.invoicePrefix, settings.nextInvoiceNumber),
    [settings.invoicePrefix, settings.nextInvoiceNumber],
  );

  useEffect(() => {
    // Load draft (POS can be resumed).
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<InvoiceDraft>;
      startTransition(() => {
        if (parsed.lines && Array.isArray(parsed.lines)) setLines(parsed.lines as InvoiceLine[]);
        if (typeof parsed.shippingInclGst === "number") setShippingInclGst(parsed.shippingInclGst);
        if (typeof parsed.discountInclGst === "number") setDiscountInclGst(parsed.discountInclGst);
        if (typeof parsed.notes === "string") setNotes(parsed.notes);
        if (parsed.customer) setCustomer(parsed.customer as Customer);
        if (typeof parsed.customerAddress === "string") setCustomerAddress(parsed.customerAddress);
        if (parsed.saleType) setSaleType(parsed.saleType as SaleType);
        if (parsed.fulfilment) setFulfilment(parsed.fulfilment as FulfilmentType);
        if (parsed.paymentMethod) setPaymentMethod(parsed.paymentMethod as PaymentMethod);
        if (parsed.status) setStatus(parsed.status as InvoiceDraft["status"]);
        if (parsed.activity && Array.isArray(parsed.activity)) {
          setActivity(parsed.activity as InvoiceDraft["activity"]);
        }
      });
    } catch {}
  }, []);

  const draft: InvoiceDraft = useMemo(
    () => ({
      invoiceNumber,
      status,
      createdAt: new Date().toISOString(),
      customer: customerName.trim()
        ? {
            id: customer?.id ?? "walkin",
            name: customerName.trim(),
            email: customerEmail.trim() || undefined,
            phone: customerPhone.trim() || undefined,
          }
        : customer,
      customerAddress: customerAddress.trim() || undefined,
      saleType,
      fulfilment,
      lines,
      shippingInclGst,
      discountInclGst,
      notes,
      paymentMethod,
      activity,
    }),
    [
      invoiceNumber,
      status,
      customer,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      saleType,
      fulfilment,
      lines,
      shippingInclGst,
      discountInclGst,
      notes,
      paymentMethod,
      activity,
    ],
  );

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return inventory.slice(0, 8);
    return inventory
      .filter((p) => p.title.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 12);
  }, [productQuery, inventory]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return CUSTOMERS.slice(0, 6);
    return CUSTOMERS.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q),
    ).slice(0, 8);
  }, [customerQuery]);

  const linesTotal = useMemo(
    () => lines.reduce((a, l) => a + l.unitPriceInclGst * l.qty, 0),
    [lines],
  );
  const totalInclGst = Math.max(0, linesTotal + shippingInclGst - discountInclGst);
  const { subtotal, gst, total } = splitGstIncluded(totalInclGst);

  const addProduct = (id: string) => {
    const p = inventory.find((x) => x.id === id);
    if (!p) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        {
          productId: p.id,
          sku: p.sku,
          title: p.title,
          qty: 1,
          unitPriceInclGst: p.price,
        },
      ];
    });
    setActivity((a) => [...a, { at: nowStamp(), text: `Added ${p.title}.` }]);
  };

  const setQty = (productId: string, qty: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, qty: clampInt(qty, 1, 999) } : l))
        .filter((l) => l.qty > 0),
    );
  };

  const removeLine = (productId: string) => {
    const l = lines.find((x) => x.productId === productId);
    setLines((prev) => prev.filter((x) => x.productId !== productId));
    if (l) setActivity((a) => [...a, { at: nowStamp(), text: `Removed ${l.title}.` }]);
  };

  const saveDraft = () => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {}
    toast({ tone: "success", title: "Draft saved", description: "Stored locally for now." });
    setActivity((a) => [...a, { at: nowStamp(), text: "Draft saved." }]);
  };

  const generateInvoice = () => {
    if (!customerName.trim() && !customer) {
      toast({ tone: "warning", title: "Customer details", description: "Add a name or select a saved customer." });
      return;
    }
    if (!lines.length) {
      toast({ tone: "warning", title: "Add products", description: "Add at least one product line." });
      return;
    }

    // Deduct inventory (local store for now).
    deductStock(lines.map((l) => ({ id: l.productId, qty: l.qty })));

    // Increment invoice counter (local org settings; backend later).
    update({ nextInvoiceNumber: settings.nextInvoiceNumber + 1 });

    setStatus("pending");
    setActivity((a) => [...a, { at: nowStamp(), text: "Invoice generated. Inventory deducted." }]);
    toast({ tone: "success", title: "Invoice generated", description: "Inventory deducted (demo store)." });

    appendOrder({
      id: invoiceNumber,
      date: new Date().toLocaleString("en-AU", { hour12: true }),
      customer: {
        name: (draft.customer?.name ?? customerName).trim() || "Walk-in",
        email: (draft.customer?.email ?? customerEmail.trim()) || "—",
        phone: draft.customer?.phone,
        address: customerAddress.trim() || undefined,
      },
      channel: saleType === "ebay" ? "ebay" : saleType === "online" ? "web" : "counter",
      status: "processing",
      paymentStatus: status === "paid" ? "paid" : "unpaid",
      saleType,
      fulfilment,
      total,
      tracking: "—",
    });
  };

  const printInvoice = () => {
    setActivity((a) => [...a, { at: nowStamp(), text: "Printed invoice." }]);
    window.print();
  };

  const emailInvoice = () => {
    setActivity((a) => [...a, { at: nowStamp(), text: "Email invoice (placeholder)." }]);
    toast({ tone: "default", title: "Email queued (demo)", description: "Email sending will be backend-driven." });
  };

  const markPaid = () => {
    setStatus("paid");
    setActivity((a) => [...a, { at: nowStamp(), text: `Payment received via ${paymentMethod.replaceAll("_", " ")}.` }]);
    toast({ tone: "success", title: "Marked as paid", description: "Status updated (demo)." });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold text-fg/55">
            <Link href="/orders" className="hover:underline">
              Orders
            </Link>{" "}
            / <span className="text-fg/75">Create</span>
          </div>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Create order (POS)</h1>
          <p className="mt-1 text-sm text-fg/70">
            Fast checkout workflow — GST included pricing and a live invoice preview.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => router.push("/inventory")}>
            Inventory
          </Button>
        </div>
      </div>

      {/* Print styles: only show invoice preview on print */}
      <style jsx global>{`
        @media print {
          header,
          nav,
          aside {
            display: none !important;
          }
          main {
            padding: 0 !important;
          }
          .ppg-pos {
            display: none !important;
          }
          .ppg-print {
            display: block !important;
          }
        }
      `}</style>

      <div className="ppg-pos grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* LEFT: product search / scan / cart */}
        <div className="space-y-6 lg:col-span-3">
          <Card>
            <CardHeader
              title="Products"
              description="Search by name or SKU, then tap a row to add."
              right={<Badge variant="outline">GST included</Badge>}
            />
            <CardContent className="space-y-4">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg/45">
                  <Icons.Search />
                </span>
                <Input
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  className="pl-9"
                  placeholder="Search products…"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addProduct(p.id)}
                    className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-bg px-4 py-3 text-left transition hover:bg-bg-2/30"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{p.title}</div>
                      <div className="truncate text-xs text-fg/60">{p.sku} · Stock {p.stock}</div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold">{formatCurrency(p.price, "AUD")}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Order lines" description="Quantity controls are keyboard-friendly." />
            <CardContent className="space-y-3">
              {lines.length ? (
                lines.map((l) => {
                  const product = inventory.find((p) => p.id === l.productId);
                  const stock = product?.stock ?? 0;
                  const after = stock - l.qty;
                  const warn = after < 0;

                  return (
                    <div
                      key={l.productId}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-bg px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{l.title}</div>
                        <div className="truncate text-xs text-fg/60">{l.sku}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant={warn ? "danger" : after <= 15 ? "warn" : "ok"}>
                            Stock after: {after}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setQty(l.productId, l.qty - 1)}
                          >
                            −
                          </Button>
                          <Input
                            value={String(l.qty)}
                            onChange={(e) => setQty(l.productId, Number(e.target.value || 1))}
                            className="h-9 w-16 text-center"
                            inputMode="numeric"
                          />
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setQty(l.productId, l.qty + 1)}
                          >
                            +
                          </Button>
                        </div>
                        <div className="w-28 text-right text-sm font-semibold">
                          {formatCurrency(l.unitPriceInclGst * l.qty, "AUD")}
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => removeLine(l.productId)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-border bg-bg-2/30 px-4 py-10 text-center text-sm text-fg/65">
                  Search or click a product to add lines.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: customer + summary + actions + preview */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
              <CardHeader title="Customer" description="Walk-in details, or select a saved customer." />
            <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-semibold text-fg/70">Sale type</div>
                    <select
                      className="h-10 w-full appearance-none rounded-lg border border-border bg-bg px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                      value={saleType}
                      onChange={(e) => setSaleType(e.target.value as SaleType)}
                    >
                      <option value="walk_in">Walk-in</option>
                      <option value="online">Online</option>
                      <option value="ebay">eBay</option>
                    </select>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-semibold text-fg/70">Fulfilment</div>
                    <select
                      className="h-10 w-full appearance-none rounded-lg border border-border bg-bg px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                      value={fulfilment}
                      onChange={(e) => setFulfilment(e.target.value as FulfilmentType)}
                    >
                      <option value="pickup">Pickup</option>
                      <option value="delivery">Delivery</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <div className="mb-2 text-xs font-semibold text-fg/70">Customer name</div>
                    <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Name" />
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-semibold text-fg/70">Email (optional)</div>
                    <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="name@email.com" />
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-semibold text-fg/70">Phone (optional)</div>
                    <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="04…" />
                  </div>
                  {fulfilment === "delivery" ? (
                    <div className="sm:col-span-2">
                      <div className="mb-2 text-xs font-semibold text-fg/70">Delivery address</div>
                      <Input
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Street, suburb, state, postcode"
                      />
                    </div>
                  ) : null}
                </div>

              <Input
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Search customers…"
              />
              <div className="grid grid-cols-1 gap-2">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCustomer(c);
                        setCustomerName(c.name);
                        setCustomerEmail(c.email ?? "");
                        setCustomerPhone(c.phone ?? "");
                      setActivity((a) => [...a, { at: nowStamp(), text: `Customer selected: ${c.name}.` }]);
                    }}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      customer?.id === c.id
                        ? "border-accent bg-accent/10"
                        : "border-border bg-bg hover:bg-bg-2/30"
                    }`}
                  >
                    <div className="text-sm font-semibold">{c.name}</div>
                    <div className="text-xs text-fg/60">{c.email}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Summary" description="GST included; breakdown shown." />
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="text-fg/70">Lines total</div>
                <div className="font-semibold">{formatCurrency(linesTotal, "AUD")}</div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-semibold text-fg/70">Shipping (inc GST)</div>
                  <Input
                    value={String(shippingInclGst)}
                    onChange={(e) => setShippingInclGst(Number(e.target.value || 0))}
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold text-fg/70">Discount (inc GST)</div>
                  <Input
                    value={String(discountInclGst)}
                    onChange={(e) => setDiscountInclGst(Number(e.target.value || 0))}
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-bg-2/30 px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <div className="text-fg/70">Subtotal (ex GST)</div>
                  <div className="font-semibold">{formatCurrency(subtotal, "AUD")}</div>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <div className="text-fg/70">GST (10%)</div>
                  <div className="font-semibold">{formatCurrency(gst, "AUD")}</div>
                </div>
                <div className="my-2 h-px bg-border" />
                <div className="flex items-center justify-between text-sm">
                  <div className="text-fg/70">Total (inc GST)</div>
                  <div className="text-base font-semibold">{formatCurrency(total, "AUD")}</div>
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold text-fg/70">Payment method</div>
                <select
                  className="h-10 w-full appearance-none rounded-lg border border-border bg-bg px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  <option value="eftpos">EFTPOS</option>
                  <option value="cash">Cash</option>
                  <option value="credit_card">Credit card</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="afterpay">Afterpay</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold text-fg/70">Notes</div>
                <textarea
                  className="min-h-[88px] w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm shadow-sm outline-none placeholder:text-fg/45 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes, delivery instructions…"
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button variant="secondary" onClick={saveDraft}>
                  Save draft
                </Button>
                <Button onClick={generateInvoice}>Generate invoice</Button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button variant="secondary" onClick={printInvoice}>
                  Print
                </Button>
                <Button variant="secondary" onClick={emailInvoice}>
                  Email
                </Button>
                <Button variant="secondary" onClick={markPaid}>
                  Mark paid
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-bg-2/30 px-4 py-3 text-xs text-fg/65">
                Invoice #{invoiceNumber} · Status{" "}
                <span className="font-semibold text-fg">{status}</span>
              </div>

              <div className="text-xs text-fg/60">
                Need to change ABN/store details?{" "}
                <Link href="/settings" className="font-semibold text-accent hover:underline">
                  Open Settings
                </Link>
              </div>
            </CardContent>
          </Card>

          <InvoicePreview draft={draft} mode="panel" />
        </div>
      </div>

      {/* Print-only invoice */}
      <div className="ppg-print hidden">
        <InvoicePreview draft={draft} mode="print" />
      </div>
    </div>
  );
}

