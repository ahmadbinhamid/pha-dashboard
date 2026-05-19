
import { useMemo } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/utils/format";
import { useCounterCart } from "@/context";
import type { InvoiceDraft, PaymentMethod } from "@/types";

const POS_DRAFT_KEY = "ppg-order-draft";

export function CounterCartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { customer, setCustomer, fulfilment, setFulfilment, saleType, setSaleType, lines, setQty, removeLine, clear } =
    useCounterCart();

  const total = useMemo(() => lines.reduce((a, l) => a + l.unitPriceInclGst * l.qty, 0), [lines]);

  const checkout = () => {
    const draft: Partial<InvoiceDraft> = {
      status: "draft",
      customer: customer.name.trim()
        ? { id: "walkin", name: customer.name.trim(), email: customer.email, phone: customer.phone }
        : null,
      customerAddress: customer.address,
      saleType,
      fulfilment,
      lines: lines.map((l) => ({ ...l })),
      shippingInclGst: 0,
      discountInclGst: 0,
      notes: "",
      paymentMethod: "eftpos" as PaymentMethod,
      activity: [{ at: new Date().toLocaleString("en-AU", { hour12: true }), text: "Counter cart sent to checkout." }],
    };
    try {
      localStorage.setItem(POS_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
    window.location.href = "/orders/new";
  };

  return (
    <Dialog open={open} onClose={onClose} title="Current customer cart" className="bg-bg" anchor="right">
      <div className="space-y-5">
        <Card className="shadow-none">
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-semibold text-fg/70">Sale type</div>
                <Select value={saleType} onChange={(e) => setSaleType(e.target.value as typeof saleType)}>
                  <option value="walk_in">Walk-in</option>
                  <option value="online">Online</option>
                  <option value="ebay">eBay</option>
                </Select>
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold text-fg/70">Fulfilment</div>
                <Select value={fulfilment} onChange={(e) => setFulfilment(e.target.value as typeof fulfilment)}>
                  <option value="pickup">Pickup</option>
                  <option value="delivery">Delivery</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="mb-2 text-xs font-semibold text-fg/70">Customer name</div>
                <Input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold text-fg/70">Email</div>
                <Input value={customer.email ?? ""} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold text-fg/70">Phone</div>
                <Input value={customer.phone ?? ""} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
              </div>
              {fulfilment === "delivery" ? (
                <div className="sm:col-span-2">
                  <div className="mb-2 text-xs font-semibold text-fg/70">Delivery address</div>
                  <Input
                    value={customer.address ?? ""}
                    onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                  />
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="rounded-xl border border-border">
          <div className="flex items-center justify-between border-b border-border bg-bg-2/60 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-fg/55">Cart</div>
            <Badge variant="outline">{lines.length} line(s)</Badge>
          </div>
          <div className="divide-y divide-border">
            {lines.length ? (
              lines.map((l) => (
                <div key={l.productId} className="flex items-start justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{l.title}</div>
                    <div className="truncate text-xs text-fg/60">{l.sku}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        value={String(l.qty)}
                        onChange={(e) => setQty(l.productId, Number(e.target.value || 1))}
                        className="h-9 w-20 text-center"
                        inputMode="numeric"
                      />
                      <Button variant="secondary" size="sm" onClick={() => removeLine(l.productId)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{formatCurrency(l.unitPriceInclGst * l.qty, "AUD")}</div>
                    <div className="text-xs text-fg/60">{formatCurrency(l.unitPriceInclGst, "AUD")} ea</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-sm text-fg/65">Cart is empty. Add parts from Inventory.</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-bg px-4 py-3">
          <div className="text-sm font-semibold">Total</div>
          <div className="text-sm font-semibold">{formatCurrency(total, "AUD")}</div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" className="flex-1" onClick={clear} disabled={!lines.length && !customer.name.trim()}>
            Clear cart
          </Button>
          <Button className="flex-1" onClick={checkout} disabled={!lines.length}>
            Checkout
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

