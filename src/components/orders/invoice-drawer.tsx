
import { Dialog } from "@/components/ui/dialog";
import type { Order } from "@/types";
import { Button } from "@/components/ui/button";
import { useOrgSettings } from "@/context";
import { useToast } from "@/context";
import type { InvoiceDraft } from "@/types";
import { InvoicePreview } from "@/components/invoicing/invoice-preview";

export function InvoiceDrawer({
  open,
  onClose,
  order,
}: {
  open: boolean;
  onClose: () => void;
  order: Order | null;
}) {
  useOrgSettings();
  const { toast } = useToast();

  const draft: InvoiceDraft | null = order
    ? {
        invoiceNumber: order.id,
        status: order.status === "paid" ? "paid" : order.status === "refunded" ? "refunded" : "pending",
        createdAt: new Date().toISOString(),
        customer: { id: order.id, name: order.customer.name, email: order.customer.email },
        lines: [
          {
            productId: order.id,
            sku: "—",
            title: "Automotive part(s)",
            qty: 1,
            unitPriceInclGst: order.total,
          },
        ],
        shippingInclGst: 0,
        discountInclGst: 0,
        notes: "",
        paymentMethod: "eftpos",
        activity: [{ at: "Now", text: "Invoice preview opened." }],
      }
    : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={order ? `Invoice — ${order.id}` : "Invoice"}
    >
      {draft ? (
        <div className="space-y-3">
          <InvoicePreview draft={draft} mode="panel" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  tone: "default",
                  title: "Download PDF (demo)",
                  description: "PDF generation will be backend-driven.",
                })
              }
            >
              Download PDF
            </Button>
            <Button
              onClick={() => toast({ tone: "success", title: "Marked invoiced", description: "Demo action." })}
            >
              Mark invoiced
            </Button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}

