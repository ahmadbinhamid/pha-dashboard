import { formatCurrencyFromCents } from "@/utils/format";

// refund-redesign-spec.md §7 — "the client computes no money — post the
// intent and render what /refundable and the response return." Before
// submit, this shows an ESTIMATE built only from figures /refundable already
// computed server-side (effective_unit_price × the quantity the admin
// picked) — never re-derived discount/GST apportionment. The authoritative
// total only ever comes from the POST response, shown once available.
export interface RefundSummaryFigures {
  items: number; // cents
  shipping: number;
  adjustment: number;
  gst: number;
  total: number;
}

export function RefundSummary({ figures, isEstimate }: { figures: RefundSummaryFigures; isEstimate: boolean }) {
  return (
    <div className="rounded-xs border border-border bg-bg-2 p-3 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg/45">Summary</span>
        {isEstimate && <span className="text-xs text-fg/45">Estimate — final total confirmed on submit</span>}
      </div>
      <div className="space-y-1">
        <Row label="Items" value={figures.items} />
        {figures.shipping !== 0 && <Row label="Shipping" value={figures.shipping} />}
        {figures.adjustment !== 0 && <Row label="Adjustment" value={figures.adjustment} />}
        <Row label="GST (included)" value={figures.gst} muted />
        <div className="mt-1.5 flex items-center justify-between border-t border-border pt-1.5 text-base font-semibold text-fg">
          <span>Total refund</span>
          <span>{formatCurrencyFromCents(figures.total)}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${muted ? "text-fg/50" : "text-fg/70"}`}>
      <span>{label}</span>
      <span>{formatCurrencyFromCents(value)}</span>
    </div>
  );
}
