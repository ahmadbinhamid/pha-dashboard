# Refund redesign — implementation spec

Target: `pha-dashboard` @ `dev`. Supports three refund scopes (full invoice, specific
line items, bare amount) across both settlement methods (Stripe, manual), with
opt-in per-line restock that propagates to local inventory and eBay.

Read this whole document before writing any code. Follow the existing
controller → service → model layering; all DB access stays in the service layer.

---

## 0. The core reframe

A refund has two **independent** properties. The current code models the second
as the branch, which is why "product refund" doesn't fit:

- **Scope** — *what* is given back: the whole invoice, specific lines + quantities,
  or a bare amount.
- **Settlement method** — *how* money returns: Stripe API, or manual/out-of-band.

Scope × method = 6 combinations. Do not write 6 code paths. One `Refund` entity
with `scope` and a settlement adapter chosen by `payment.provider`.

A second reframe: **refunds become order-scoped, not payment-scoped.** An item
refund is driven by what the customer returns, not by which card paid. Orders
already support multiple `Payment` docs (deposit + payment link), so a refund
needs to allocate across them.

---

## 1. Model changes

### 1.1 `models/Order.js` — `orderItemSchema`

Add to each line item:

```js
// Cumulative across every succeeded refund touching this line. The remaining
// refundable quantity is (quantity - quantity_refunded). This is the ledger
// that makes repeat partial refunds safe — it cannot be reliably derived by
// summing Refund docs, because dashboard-issued refunds carry no line data.
quantity_refunded: { type: Number, default: 0, min: 0 },
amount_refunded:   { type: Number, default: 0, min: 0 }, // cents, line's share only
quantity_restocked: { type: Number, default: 0, min: 0 }, // <= quantity_refunded
```

`quantity_restocked` is tracked separately from `quantity_refunded` because
restock is opt-in: refunding 2 units with restock unchecked must not later be
mistaken for units that came back into stock.

Add a virtual or service helper — do not compute this in the frontend:

```js
// refundable_quantity = quantity - quantity_refunded
```

### 1.2 `models/Order.js` — status split

`ORDER_STATUS` currently mixes payment state and fulfilment state in one enum,
and `finalizeSucceededRefund` overwrites `FULFILLED` with `REFUNDED`. Split:

```js
payment_status:     { enum: [pending_payment, partially_paid, paid, partially_refunded, refunded] },
fulfillment_status: { enum: [unfulfilled, fulfilled, cancelled] },
```

Keep `status` as a deprecated derived field for one release so existing reads and
`OrderStatusBadge.tsx` don't break. Backfill script: `payment_status` from current
`status` when it's a payment value, else derive from `getTotalPaidForOrder`;
`fulfillment_status = fulfilled` where `status === 'fulfilled'`, else `unfulfilled`.

### 1.3 `models/Refund.js` — full rewrite

```js
const refundLineSchema = new Schema({
  // Index into order.items at the time of refund. Order items have _id: false,
  // so add _id: true to orderItemSchema OR store item_index + a sku/name
  // snapshot for integrity checking. Prefer adding _id to order items —
  // index-based references break if items are ever reordered or removed.
  order_item_id: { type: Schema.Types.ObjectId, required: true },
  sku:  { type: String, default: null },
  name: { type: String, required: true },        // snapshot, for the credit note

  quantity: { type: Number, required: true, min: 1 },

  // All derived server-side from the order at refund time — never accepted
  // from the client. See §3.2 for the exact formula.
  unit_price:      { type: Number, required: true }, // cents, GST-inclusive
  line_amount:     { type: Number, required: true }, // effective, net of discounts
  gst_amount:      { type: Number, required: true }, // line_amount / 11, rounded

  restock: { type: Boolean, default: false },
  restock_applied_at: { type: Date, default: null },
  ebay_sync_status: { type: String, enum: ["not_applicable","pending","synced","failed"], default: "not_applicable" },
  ebay_sync_error:  { type: String, default: null },
}, { _id: false });

const refundSchema = buildSchema({
  order: { type: Schema.Types.ObjectId, ref: "Order", required: true },

  // Which Payment doc(s) the money comes off. Multiple entries when one refund
  // spans a deposit + a card payment. Sum of allocations === total_amount.
  payment_allocations: [{
    payment: { type: Schema.Types.ObjectId, ref: "Payment", required: true },
    amount:  { type: Number, required: true, min: 1 }, // cents
    provider: { type: String, required: true },        // snapshot of payment.provider
    stripe_refund_id: { type: String, default: null }, // per-allocation, not per-refund
  }],

  refund_number: { type: String, required: true, unique: true }, // "CN-00001", via Counter

  scope: { type: String, enum: ["full_order","line_items","amount"], required: true },
  lines: { type: [refundLineSchema], default: [] },

  shipping_amount:   { type: Number, default: 0 },  // cents, >= 0
  adjustment_amount: { type: Number, default: 0 },  // signed: + goodwill, - restocking fee

  // total_amount = sum(lines.line_amount) + shipping_amount + adjustment_amount
  items_amount: { type: Number, required: true, default: 0 },
  gst_amount:   { type: Number, required: true },   // see §3.3 for drift rule
  total_amount: { type: Number, required: true, min: 1 },

  reason: { type: String, enum: Object.values(REFUND_REASON), required: true },
  internal_note: { type: String, default: null },

  status: { type: String, enum: Object.values(REFUND_STATUS), default: REFUND_STATUS.PENDING },
  failure_reason: { type: String, default: null },

  // Set once, inside the transaction that applies ledger effects. Every effect
  // application checks this first — makes webhook redelivery and retry safe.
  effects_applied_at: { type: Date, default: null },

  // Client-supplied per refund attempt. Replaces the partial unique index on
  // {payment, status:pending}, which false-positives on legitimate concurrent
  // refunds of different products and collides with dashboard reconciliation.
  idempotency_key: { type: String, default: null },

  initiated_via: { type: String, enum: ["admin_api","stripe_dashboard","manual"], default: "admin_api" },
  initiated_by:  { type: Schema.Types.ObjectId, ref: "User", default: null },

  // Reversal trail for a refund that failed after succeeding, or a mistaken
  // manual refund. Never hard-delete a Refund.
  voided_at: { type: Date, default: null },
  voided_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
  void_reason: { type: String, default: null },
});
```

**Indexes** — replace the existing two entirely:

```js
refundSchema.index({ order: 1, created_at: -1 });
refundSchema.index({ "payment_allocations.payment": 1 });
refundSchema.index({ "payment_allocations.stripe_refund_id": 1 }, { unique: true, sparse: true });
refundSchema.index({ idempotency_key: 1 }, { unique: true, sparse: true });
```

The unique sparse index on `stripe_refund_id` is load-bearing. Today there is
**no index at all** on it, and `handleChargeRefunded` loops every refund on the
payment intent on every delivery — two concurrent `charge.refunded` events can
both miss the same refund id and both insert it. `claimEvent` only dedupes by
Stripe *event* id, which does not help here.

**Delete** the partial unique index `{ payment: 1, status: pending }`.

### 1.4 `constants/refund.constants.js`

```js
const REFUND_STATUS = {
  PENDING:    "pending",     // record written, money not yet moved
  PROCESSING: "processing",   // Stripe accepted, awaiting webhook confirmation
  SUCCEEDED:  "succeeded",
  FAILED:     "failed",
  CANCELED:   "canceled",     // Stripe refund canceled before settling
  VOIDED:     "voided",       // reversed by an admin after succeeding
};

const REFUND_REASON = {
  // Goods physically returned — restock defaults ON in the UI
  CUSTOMER_RETURN: "customer_return",
  ORDER_CANCELLED: "order_cancelled",
  WRONG_ITEM_SENT: "wrong_item_sent",
  // Goods not returned or unsellable — restock defaults OFF
  DAMAGED_ON_ARRIVAL: "damaged_on_arrival",
  CUSTOMER_REQUEST: "customer_request",
  GOODWILL: "goodwill",
  PRICE_ADJUSTMENT: "price_adjustment",
  DUPLICATE_PAYMENT: "duplicate_payment",
  FRAUD_SUSPECTED: "fraud_suspected",
  PAYMENT_ERROR: "payment_error",
  OTHER: "other", // reserved for Stripe-dashboard reconciliation
};

const RESTOCK_DEFAULT_REASONS = new Set([
  CUSTOMER_RETURN, ORDER_CANCELLED, WRONG_ITEM_SENT,
]);
```

`RESTOCK_DEFAULT_REASONS` drives the **UI default only**. The server must never
restock on reason alone — see §3.5.

Keep a mapping from the old reason values for the migration.

---

## 2. API contract

Move refunds off `/payment/:id/*` onto the order, since line items and
multi-payment allocation are both order-level concerns. Keep the old endpoints
as thin deprecated shims for one release.

### 2.1 `GET /orders/:orderId/refundable`

Server tells the UI what is possible. The UI computes nothing.

```json
{
  "order_total": 20000,
  "total_paid": 20000,
  "total_refunded": 2000,
  "max_refundable": 18000,
  "shipping": { "amount": 1500, "refunded": 0, "refundable": 1500 },
  "lines": [
    {
      "order_item_id": "...", "name": "Brake pad set", "sku": "BP-114",
      "quantity": 3, "quantity_refunded": 1, "refundable_quantity": 2,
      "unit_price": 5000,
      "effective_unit_price": 4750,
      "refundable_amount": 9500,
      "has_inventory_record": true,
      "has_ebay_listing": true
    }
  ],
  "payments": [
    { "payment_id": "...", "provider": "stripe", "method": null,
      "amount": 15000, "amount_refunded": 2000, "refundable": 13000,
      "stripe_refundable": 13000, "stripe_window_open": true,
      "settlement": "stripe" },
    { "payment_id": "...", "provider": "manual", "method": "cash",
      "amount": 5000, "amount_refunded": 0, "refundable": 5000,
      "settlement": "manual" }
  ]
}
```

- `effective_unit_price` is net of discounts (§3.2). The UI displays
  `unit_price` and refunds `effective_unit_price`.
- `has_inventory_record` / `has_ebay_listing` let the UI disable or warn on the
  restock checkbox for SKU-less or unlisted lines instead of silently no-oping.
- `stripe_window_open` is false past ~180 days from `payment.paid_at`; the UI
  must then force manual settlement.

### 2.2 `POST /orders/:orderId/refunds`

```jsonc
{
  "idempotency_key": "uuid-from-client",
  "scope": "line_items",                  // full_order | line_items | amount
  "lines": [                              // required iff scope != amount
    { "order_item_id": "...", "quantity": 2, "restock": true }
  ],
  "refund_shipping": false,               // ignored unless scope = full_order (§3.4)
  "amount": 2000,                         // required iff scope = amount, else forbidden
  "adjustment_amount": -500,              // optional, signed
  "reason": "customer_return",
  "internal_note": "Returned unused, resellable",
  "payment_allocations": [                // optional; server auto-allocates if omitted
    { "payment_id": "...", "amount": 9500 }
  ]
}
```

Joi rules:
- `amount` is `forbidden()` when `scope` is `full_order` or `line_items`.
- `lines` is `forbidden()` when `scope` is `amount`, `required().min(1)` otherwise.
- `lines` must have no duplicate `order_item_id`.
- `scope: full_order` may omit `lines` — the server fills them from all
  remaining refundable quantity. `restock` for that case comes from a top-level
  `restock_all: Boolean`.

### 2.3 Other endpoints

- `GET /orders/:orderId/refunds` — history, with lines populated.
- `POST /refunds/:id/void` — admin reversal (§3.8).
- `POST /refunds/:id/retry-restock` — re-runs only the restock/eBay leg for a
  refund whose `effects_applied_at` is set but which has lines with
  `ebay_sync_status: failed`.

---

## 3. Service logic

New file `services/refund-calculator.service.js` for pure math (no DB writes),
so it is unit-testable. `refund.service.js` keeps orchestration.

### 3.1 Validation order

Run every check before writing anything:

1. Order exists; `payment_status` is one of `paid`, `partially_paid`,
   `partially_refunded`.
2. `scope: amount` → `1 <= amount <= max_refundable`.
3. `scope: line_items` → for each line, `0 < quantity <= refundable_quantity`.
   Reject the whole request on the first violation; never partially apply.
4. Computed `total_amount >= 1` after `adjustment_amount` is applied. A negative
   restocking fee must not make the total zero or negative.
5. `total_amount <= order.total - total_refunded_for_order`. **This cap is
   absolute** and is the last line of defence against every rounding and
   discount bug below.
6. Allocations: `sum(allocations.amount) === total_amount`; each allocation
   `<= payment.refundable`; each Stripe allocation `<= stripe_refundable` and
   within the refund window; every referenced payment has `status: succeeded`.
7. `idempotency_key` not already present → else return the existing refund
   with `200`, not a `409`.

### 3.2 Effective line amount — get this right or you over-refund

`unit_price × quantity` is **wrong**. There are two discount layers:

```
line_gross      = item.unit_price * refund_quantity
line_discount   = round(item.discount_amount * refund_quantity / item.quantity)
order_discount_share =
    order.discount_amount === 0 ? 0
  : round(order.discount_amount * line_gross / sum_of_all_line_gross_in_order)
      scaled to the refunded quantity
line_amount     = line_gross - line_discount - order_discount_share
```

`order.discount_amount` is applied after the fact via
`order.service.js#updateOrderDiscount`, so it is not baked into any line.
Apportion it pro-rata by each line's gross contribution to `order.subtotal`.

Also honour `original_unit_price`: if `unit_price` was edited after the order was
placed, refund against `unit_price` (what was actually charged), never
`original_unit_price`. Add a test for a line that was price-edited *and*
discounted.

Sanity assertion: `sum(all lines' full line_amount) + shipping_cost === order.total`.
If it does not, the order has drifted — refuse item refunds on that order and
surface it for manual reconciliation rather than guessing.

### 3.3 GST and rounding drift

`order.tax_amount = subtotal / 11` (AU GST-inclusive convention). Per-line
`gst_amount = round(line_amount / 11)`. The sum of per-line GST across several
partial refunds will not equal `round(order.tax_amount)`.

Rule: when a refund exhausts the remaining refundable balance
(`total_amount === order.total - total_refunded`), do not compute GST from the
lines. Set:

```
gst_amount = order.tax_amount - sum(gst_amount of all prior succeeded refunds)
```

Otherwise credit notes will not tie back to the tax invoice. Test with an order
whose total is not divisible by 11, refunded in three uneven parts.

### 3.4 Shipping

`order.shipping_cost` belongs to no line. Rules:

- `scope: full_order` → shipping is included when `refund_shipping` is true;
  default it true in the UI for full-invoice refunds.
- `scope: line_items` → shipping is never included. Refunding one of three items
  does not mean you did not ship.
- `scope: amount` → shipping is not a concept; the amount is opaque.
- Shipping is refundable **once**. Track cumulatively:
  `sum(refunds.shipping_amount) <= order.shipping_cost`.
- Pickup orders have `shipping_cost: 0` — nothing to do, but assert it rather
  than assuming.

### 3.5 Restock

Restock is **per line, explicit, and never inferred**. Delete the current
condition entirely:

```js
// REMOVE — contradicts an explicit per-line UI checkbox:
const shouldRestock = isFullRefund && (restock || reason === REFUND_REASON.ORDER_CANCELLED);
```

Replace with: restock a line iff `line.restock === true`. Reason only sets the
UI's default checkbox state (`RESTOCK_DEFAULT_REASONS`); the server obeys the
submitted booleans. An admin who unchecks restock on a cancelled order must not
get a restock.

Also:
- `scope: amount` refunds can never restock — no lines, no quantities.
- A line with `sku: null` cannot restock. Return a per-line warning in the
  response rather than silently ignoring it.
- Restock quantity is the refunded quantity, not the whole line quantity.

### 3.6 `syncOrderStock` — add partial-quantity support

`services/order-stock-sync.service.js` currently iterates all `order.items` at
full `item.quantity`. Change the signature, keeping the default behaviour
identical so `handlePaymentSucceeded` and `order.service.js:250` need no edits:

```js
async function syncOrderStock(order, direction, {
  reasonPrefix, saleType, refundType,
  lines = null,   // NEW: [{ sku, quantity, order_item_id }] — null means all items, full qty
  refundId = null // NEW: for InventoryHistory attribution
} = {}) {
```

When `lines` is provided, iterate those instead of `order.items`, using each
entry's `quantity`. Return per-line results (`{ order_item_id, ebay_sync_status,
ebay_sync_error, shortfall }`) so the caller can write them onto
`refund.lines[]` rather than onto `order.items[].ebay_sync_status` — the order
item field is a single slot and a second partial refund on the same line would
overwrite the first refund's sync trail.

Keep the existing "eBay failure never throws, enqueue `push_quantity` retry"
behaviour exactly as-is. It is correct.

### 3.7 Settlement and effect application

**Revised — no Mongo transaction.** Production runs a standalone `mongod` (verified: `docker-compose.yml`'s `mongo` service is plain `image: mongo:7`, no `--replSet`, no `rs.initiate()` anywhere in the repo; `MONGO_URI` has no `replicaSet=` param). Multi-document transactions require a replica set and are not available.

The original fallback idea — an ordered write sequence with `effects_applied_at` set last — is **not actually crash-safe**: `+=` increments are not idempotent, so a crash between an increment and setting the flag means the next retry double-counts. The real fix is to stop incrementing anything.

**Every ledger field the refund system writes becomes derived state: recomputed from the `Refund` collection and assigned absolutely, never incremented.** This is the same pattern `handleChargeRefunded` already uses correctly today (`payment.amount_refunded = charge.amount_refunded`, not `+=`) — §3.7 now applies that pattern everywhere instead of just at that one call site.

```
1. Validate (§3.1). Compute all amounts (§3.2–3.4, with the largest-remainder +
   exhaustion-residual rounding rules — see the revised §3.2/§3.3).
2. Mint refund_number from Counter.
3. Insert Refund { status: pending, effects_applied_at: null }.
   Unique idempotency_key catches concurrent double-submits → return existing.
4. For each allocation, in order:
     provider = stripe → stripe.refunds.create({
         payment_intent, amount: allocation.amount,
         reason: mapReasonToStripe(reason),
         metadata: { refund_id, refund_number, order_number }
       }, { idempotencyKey: `refund_${refund._id}_${allocation.payment}` })
       → store allocation.stripe_refund_id; refund.status = processing
     provider = manual | ebay → nothing to call; counts as settled
5. If every allocation is manual → status = succeeded, call applyRefundEffects now.
   If any allocation is Stripe → leave processing; applyRefundEffects is called
   by the charge.refunded webhook once Stripe confirms. Never call it
   optimistically right after creating the Stripe refund request.
6. applyRefundEffects(refund) — safe to call any number of times, from any
   caller (initial settlement, webhook redelivery, a stuck-refund sweep,
   whatever). It has two parts with two different safety properties:

   (a) Ledger recompute — always runs, unconditionally. No guard, because
       none is needed: every write here is an absolute recompute-and-assign,
       so calling it twice (or crashing mid-way and calling it again) just
       reproduces the same correct values.

         succeeded = await Refund.find({ order: refund.order, status: SUCCEEDED })
                       .select("lines payment_allocations")
                       // uses the new {order:1, status:1} index — one query,
                       // covers every succeeded refund on the order, not just
                       // this one — a void'd refund's status is no longer
                       // SUCCEEDED, so it's naturally excluded here without
                       // any separate "subtract it back out" logic (see §3.8).

         for each order.items[i]:
           quantity_refunded  = Σ line.quantity over `succeeded`'s lines
                                 where line.order_item_id === items[i]._id
           quantity_restocked = Σ line.quantity over the same, where
                                 line.restock_applied_at is set

         for each Payment referenced by any allocation across `succeeded`:
           payment.amount_refunded = Σ allocation.amount over `succeeded`'s
                                      allocations where allocation.payment
                                      === payment._id
           // NOT just this refund's own payments — a payment can have
           // received allocations from several different refunds over time,
           // and this must reconstruct its true total every time.

         order.payment_status recomputed from total refunded (the sum of the
           payment.amount_refunded values just derived) vs order.total — same
           three-way rule as §3.9. fulfillment_status untouched.

         save order + every touched payment.

   (b) Restock + eBay — guarded, because this IS a real side effect (a stock
       adjustment, a live eBay push), not derived state, and must run at most
       once:

         if (refund.effects_applied_at) return;  // already attempted — see
                                                    // retry-restock (§2.3) for
                                                    // recovering a partial
                                                    // eBay failure instead of
                                                    // re-running this
         syncOrderStock(order, RESTOCK, { lines: linesWithRestockTrue, refundId })
         write per-line ebay_sync_status back onto refund.lines
         set line.restock_applied_at for lines that actually restocked
         re-run (a)'s quantity_restocked recompute (cheap, one indexed query,
           idempotent — no reason to hand-maintain a separate code path)
         send credit-note email (best effort, never throws)
         set refund.effects_applied_at = now
           // marks "the restock leg has been attempted for this refund" —
           // NOT a correctness guard on money. Money never needed one.
```

Consequence for §3.8 (void): reversing a refund's money/quantity effects no longer means writing decrement logic. Setting `refund.status = voided` removes it from the `status: SUCCEEDED` query in step 6a, so simply re-running 6a naturally re-derives every affected order item and payment back to what they should be with this refund excluded. The only genuinely imperative part of a void is still the restock reversal (re-deducting stock for lines where `restock_applied_at` was set, pushing the lowered quantity to eBay) — a real side effect, same as 6b, and stays explicit. Full detail in the revised §3.8 when that phase comes up.

New index this depends on: `refundSchema.index({ order: 1, status: 1 })`.

Wrap steps in the transaction with `session`. Mongo requires a replica set for
transactions — confirm the deployment has one; if it is a standalone, fall back
to an ordered write sequence with `effects_applied_at` set **last**, so a crash
mid-way is retryable rather than double-applied.

### 3.8 Void / reversal

A Stripe refund can fail after initially succeeding, and staff mistype manual
refunds. Add `POST /refunds/:id/void`:

- Only from `succeeded`.
- Reverses everything `applyRefundEffects` did: decrement `quantity_refunded`,
  `amount_refunded`, `payment.amount_refunded`; re-deduct stock for lines where
  `restock_applied_at` is set (and push the lowered quantity to eBay);
  recompute `payment_status`.
- Sets `status: voided`, `voided_at`, `voided_by`, `void_reason`. Never deletes.
- For a Stripe refund that Stripe itself reversed, this is triggered
  automatically from the `charge.refund.updated` webhook (§4.2), not by an admin.

### 3.9 Order payment status — fix the existing bug

Both `refund.service.js:53` and `stripe.webhook.service.js:287` compare
`payment.amount_refunded >= payment.amount`. On a multi-payment order that marks
the whole order `REFUNDED` after refunding only the deposit. Replace both with:

```js
const totalRefunded = await getTotalRefundedForOrder(order._id);
const totalPaid     = await getTotalPaidForOrder(order._id); // already nets refunds
if (totalRefunded === 0)                    payment_status = derivePaymentStatus(totalPaid, order.total);
else if (totalRefunded >= order.total)      payment_status = REFUNDED;
else                                        payment_status = PARTIALLY_REFUNDED;
```

And never touch `fulfillment_status`.

---

## 4. Webhook changes

### 4.1 `charge.refunded`

Rewrite `handleChargeRefunded`:

- Look up by `payment_allocations.stripe_refund_id` (now indexed and unique).
- Known id → set that allocation's status; if all allocations on the refund are
  settled and `sr.status === 'succeeded'`, call `applyRefundEffects(refund)`.
  The `effects_applied_at` guard makes redelivery safe.
- Unknown id → dashboard-issued. Create a `Refund` with `scope: 'amount'`,
  `initiated_via: 'stripe_dashboard'`, `lines: []`, no restock, and a new flag
  `needs_reconciliation: true` so `RefundHistoryList.tsx` can badge it as
  unallocated — a dashboard refund cannot know which products came back.
  Catch E11000 on the unique index and treat it as "another delivery won the
  race", not an error.
- Stop looping `stripe.refunds.list()` on every delivery. Read the refund id off
  the event where possible; if you must list, guard the create with the unique
  index rather than a read-then-act `findOne`.
- Keep `payment.amount_refunded = charge.amount_refunded` (assign, never
  increment) — that part is already correct and idempotent.

### 4.2 New: `charge.refund.updated`

Subscribe to it. On transition to `failed` or `canceled` for a refund whose
`effects_applied_at` is set, run the §3.8 reversal automatically and alert an
admin. Without this, a refund that Stripe later rejects leaves you having
restocked goods and credited a customer who was never actually paid back.

---

## 5. eBay-channel orders

`PAYMENT_PROVIDER.EBAY` payments settle through eBay Managed Payments, so a
refund here is bookkeeping only — and restocking locally pushes quantity *up* on
eBay. If the refund was not actually issued on eBay's side, stock rises while
eBay still counts the sale.

Add a required acknowledgement on the refund request when any allocation has
`provider: 'ebay'`: `ebay_refund_confirmed: true`, with the UI copy stating the
admin has already refunded in Seller Hub. Store it on the Refund.

---

## 6. Migration order

Each step must ship green on its own.

1. **Additive schema only.** New fields on `orderItemSchema` and `Refund`,
   all defaulted. New indexes created in the background. Add `_id: true` to
   `orderItemSchema` (`{ _id: false }` today) so refund lines can reference
   items stably — verify nothing relies on items lacking `_id`.
2. **Backfill.** Script in `server/scripts/`:
   - `Refund.order` already exists; set `scope: 'amount'`, `total_amount = amount`,
     `items_amount: 0`, `gst_amount = round(amount/11)`, and build
     `payment_allocations` from the old single `payment` + `amount`.
   - Move `stripe_refund_id` into the allocation.
   - `orderItemSchema.quantity_refunded`: for every historical refund where
     `reason === 'order_cancelled'` and it was a full refund, set each line's
     `quantity_refunded = quantity` and `quantity_restocked = quantity`
     (that matches what the old restock rule actually did). Everything else
     stays 0 — old partial refunds never touched quantities.
   - Backfill `payment_status` / `fulfillment_status` (§1.2), and
     `refund_number` via the Counter.
3. **Drop** the partial unique index `{payment, status: pending}` only after the
   `idempotency_key` index exists and the new endpoint is live.
4. **New endpoints** alongside the old. Old `/payment/:id/refund` becomes a shim
   that constructs a `scope: 'amount'` request.
5. **Fix §3.9** (the order-status bug) — this is independent of everything else
   and should ship first if you want it out sooner.
6. **Frontend**: extend `RefundDialog.tsx` / `ManualRefundModal.tsx` per §7.
7. **Remove** the shims and the deprecated `status` field.

---

## 7. Frontend notes

Single dialog, one settlement path chosen by the order's payments — do not build
separate Stripe and manual dialogs.

Step 1 — refund type: three radios (whole invoice / specific items / amount only).
Step 2 varies:
- **Whole invoice**: read-only line list, one "restock all returned items"
  checkbox, plus a shipping toggle.
- **Specific items**: searchable checkbox list of lines with
  `refundable_quantity > 0`. Per line: a quantity stepper capped at
  `refundable_quantity`, and its own restock checkbox defaulted from the reason.
  Disable the restock checkbox with a tooltip when `has_inventory_record` is
  false. Lines already fully refunded show as struck through, not hidden.
- **Amount only**: a single amount input capped at `max_refundable`. No restock
  control at all.

Always: reason select, internal note, and a server-computed summary
(items / shipping / adjustment / GST / total). The client never computes money —
post the intent and render what `/refundable` and the response return.

Generate `idempotency_key` client-side once per dialog open, not per submit
click, so a double-click reuses it.

---

## 8. Edge-case matrix

| # | Scenario | Expected behaviour |
|---|---|---|
| 1 | Refund 2 of 3 units, then 1 more | Both allowed; third attempt rejected — `refundable_quantity` hits 0 |
| 2 | Refund 2 units twice concurrently | One succeeds; other rejected by validation or idempotency key. Never 4 units off a 3-unit line |
| 3 | Line was price-edited after order | Refund against current `unit_price`, not `original_unit_price` |
| 4 | Line has `discount_amount: 500` | Refund `(unit_price × qty) − pro-rata line discount` |
| 5 | Order-level discount set post-hoc | Apportion pro-rata across lines by gross contribution |
| 6 | Order total not divisible by 11, three uneven partial refunds | Final refund's GST = `order.tax_amount − sum(prior GST)`; totals tie out |
| 7 | Item refund on a discounted, price-edited, partially-refunded line | All three adjustments compose; total still capped by §3.1.5 |
| 8 | `scope: amount` for $20 on a $200 order | No line quantities touched, no restock, `payment_status: partially_refunded` |
| 9 | Sum of amount-only refunds reaches order total | `payment_status: refunded`, but every line's `quantity_refunded` stays 0 — correct; goods were never returned |
| 10 | Refund exceeds order total | Rejected by the absolute cap |
| 11 | Order paid via deposit (cash) + Stripe balance | Server auto-allocates: manual portion off the cash payment, rest off Stripe. Both recorded on one Refund |
| 12 | Refund larger than any single payment | Split across allocations; rejected only if it exceeds total refundable |
| 13 | Stripe refund window (~180d) expired | `/refundable` returns `stripe_window_open: false`; UI forces manual; server rejects a Stripe allocation |
| 14 | Stripe API errors mid-multi-allocation | Earlier allocations already created at Stripe. Mark refund `failed`, record which allocations settled, surface for manual completion. Do not silently retry |
| 15 | Stripe returns `pending`, then `succeeded` via webhook | Effects applied once, on the webhook, guarded by `effects_applied_at` |
| 16 | Stripe refund succeeds then flips to `failed` | `charge.refund.updated` triggers automatic reversal (§3.8), including re-deducting restocked stock |
| 17 | Duplicate `charge.refunded` delivery | `claimEvent` dedupes the event; `effects_applied_at` dedupes the effects |
| 18 | Two different `charge.refunded` events, same charge, concurrent | Unique index on `stripe_refund_id` prevents duplicate Refund docs |
| 19 | Refund issued from the Stripe dashboard | Recorded as `scope: amount`, `needs_reconciliation: true`, no restock, badged in the UI |
| 20 | Dashboard refund racing an admin refund on the same payment | No pending-slot collision any more — the partial unique index is gone |
| 21 | Restock on a line with `sku: null` | Money refunded; restock skipped with a per-line warning in the response |
| 22 | Restock on a SKU with no `Inventory` record | `adjustStockForSku` returns null → line flagged, order flagged, refund still succeeds |
| 23 | eBay push fails during restock | Local stock is authoritative; line gets `ebay_sync_status: failed`, `push_quantity` retry enqueued, refund succeeds |
| 24 | eBay retry never succeeds | `POST /refunds/:id/retry-restock` re-runs only the eBay leg |
| 25 | Refund an eBay-channel order | Manual settlement, `ebay_refund_confirmed` required, restock still pushes quantity up |
| 26 | Refund a `FULFILLED` order | `payment_status` changes; `fulfillment_status` stays `fulfilled` |
| 27 | Refund a `MANUAL` channel order | Stock was deducted at creation, so restock is valid and symmetric |
| 28 | Refund shipping twice | Second attempt rejected — cumulative shipping cap |
| 29 | Item refund on a pickup order | `shipping_cost` is 0; assert rather than assume |
| 30 | Restocking fee larger than the item value | `total_amount` would be ≤ 0 → rejected at validation |
| 31 | Admin voids a manual refund that restocked | Stock re-deducted, eBay quantity lowered, `status: voided`, nothing deleted |
| 32 | Order items reordered or removed after a refund exists | `order_item_id` references survive; guard any item-removal path against removing a refunded line |
| 33 | Concurrent refund + `updateOrderDiscount` | Discount change invalidates line math. Recompute inside the transaction and re-assert the §3.2 sanity check |

---

## 9. Tests to write

Unit (`refund-calculator.service.js`, no DB):
- effective line amount across all four discount/price-edit combinations
- GST drift across three uneven partials on a non-divisible total
- allocation splitting across mixed-provider payments
- rejection cases: over-quantity, over-amount, negative total

Integration:
- full invoice refund with restock → inventory and eBay push asserted
- single-item partial refund with restock, then a second partial on the same line
- amount-only refund leaves all quantity ledgers at 0
- `applyRefundEffects` called twice applies once
- `charge.refunded` redelivery applies once
- concurrent double-submit with the same `idempotency_key` returns one refund
- Stripe failure mid-allocation leaves a consistent, reviewable state
- void reverses money, quantities, and stock
- multi-payment order: refunding the deposit does not mark the order `refunded`
- refunding a `FULFILLED` order preserves `fulfillment_status`

Concurrency stress: N parallel refunds of 1 unit on a 5-unit line — exactly 5
succeed, ledger never exceeds the line quantity.
