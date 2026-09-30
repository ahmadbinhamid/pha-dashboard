# Custom order lines

Staff can add a one-off product (title, price, optional per-unit shipping,
optional discount) while creating a manual order. It belongs to that order
only: it never becomes a catalogue product and never touches stock or eBay.

## Data model

There is no separate collection. A custom product is stored as one entry in
that order's `items` array (`orders` collection):

| Field | Catalogue line | Custom line |
|---|---|---|
| `product` | ObjectId of the Product | `null` |
| `is_custom` | `false` (or absent on older orders) | `true` |
| `sku` | product/variant SKU | `null` |
| `name`, `unit_price` (cents), `quantity`, `discount_amount` (cents), `note` | snapshot at order time | as typed by staff |

Schema change in `server/src/models/Order.js` (`orderItemSchema`):

- `product` is required only when `is_custom` is false; it defaults to `null`.
- `is_custom: Boolean`, default `false`.

No migration, no backfill, no index change. Existing items have a `product`,
and a missing `is_custom` reads as `false`.

Per-unit shipping is not stored on the line. At creation it is summed
(shipping x quantity) into the order-level `shipping_cost`, exactly as for
catalogue lines. Pickup orders charge no shipping for any line.

Before the order is created, a custom line lives only in the browser POS cart
(localStorage key `pha-dashboard-pos-cart`) under the key `custom:<uuid>`.
The uuid is generated once, when the line is added, and stored on the cart item.

## Where it is accepted

Only `POST /order/manual` accepts custom lines
(`validators/order.validation.js#customLineSchema`). The service helper
`order.service.js#resolveCustomOrderItem` converts dollars to cents and
rejects a discount above the line subtotal; it does no DB access.
Storefront checkout and eBay ingestion cannot create custom lines.

## Stock and eBay

`order-stock-sync.service.js#syncOrderStock` skips any line without a SKU, so
custom lines are never deducted, never written to inventory history and never
pushed to eBay.

## Reports

- Revenue and items sold include custom lines.
- Gross profit excludes custom-line revenue entirely. A custom line has no cost
  basis, so counting it would report every custom sale as 100% margin. It is
  not treated as zero-cost revenue, and there is deliberately no cost field.
- The excluded amount is returned as `excludedCustomRevenueCents` on
  `GET /reports/summary` and on each `GET /reports/sales-performance` row.
  The Reports page shows it under the Gross Profit card ("Excludes $X
  custom-line revenue (no cost)"), under each channel's Profit cell
  ("excl. $X custom"), and as an `excludedCustomRevenue` column in both PDF
  exports. When there is no custom revenue in the range, nothing is shown.
- Inventory turnover skips custom lines (they were never stock).
- Top categories counts custom-line revenue under "Uncategorized".

## Refunds

- A custom line can be refunded by quantity or amount like any other line.
- Restock is never applied: `restock` is forced false for a line with no SKU.
- `refund.service.js#annotateInventoryAndListingFlags` filters out lines with
  no product before querying, so a custom line always reports
  `has_inventory_record: false` and `has_ebay_listing: false`, and an order of
  only custom lines runs no stock/listing queries.

## Rollback window

Once any order contains a custom line, reverting the `Order.js` schema change
(making `product` required again) breaks every path that calls `.save()` on
that order. Mongoose validates every path of the document on save, including
unmodified array items, so the custom line fails `product: required`.

This was verified by re-requiring `product` on the live model against a fixture
order containing a custom line and calling each path.

### Breaks (throws `ValidationError: items.N.product: Path product is required`)

Every `.save()` on an Order document:

"Run" means exercised in the simulation; "Code" means found by reading the
call site only.

| Call site | Operation | Checked |
|---|---|---|
| `order.service.js#recordOrderPayment` | record a cash/transfer payment | Run |
| `order.service.js#updateOrderCustomerDetails` | edit customer/address snapshot | Run |
| `order.service.js#updateOrderReferenceNumber` | set PO/reference number | Run |
| `order.service.js#updateOrderItemPrice` | edit a line price | Run |
| `order.service.js#updateOrderShippingCost` | edit freight | Run |
| `order.service.js#updateOrderItemDiscount` | edit a line discount | Run |
| `order.service.js#addOrderNote` | add an internal note | Run |
| `order.service.js#updateOrderStatus` | change fulfillment status | Run |
| `refund.service.js#recomputeLedger` via `createRefund` | issue a refund | Run |
| `refund.service.js#recomputeLedger` via `voidRefund`, `retryRestockForRefund` | void / retry restock | Code |
| `softDelete.plugin.js#softDelete` | soft-delete the order | Run |
| `order.service.js#sendOrderNotification` | email a delivery order (save runs before the email, so nothing is sent) | Code |
| `stripe.payment.service.js#createPaymentIntentForOrder` | customer pays a manual order's payment link | Code |
| `stripe.webhook.service.js#handlePaymentSucceeded` | Stripe confirms that payment | Code |
| `order.service.js#createManualOrder` | final save; new orders only | Code |

Not reachable for custom lines: `createOrderFromEbayOrder` and
`updateEbayOrderStatus` (eBay orders) and
`stripe.cleanup.service.js#cleanupAbandonedOrders` (storefront orders only).

Two of these fail after an earlier write has already landed, leaving
inconsistent data rather than a clean error. Both were verified in the
simulation:

- `refund.service.js#createRefund`: the Refund document is created and marked
  `succeeded`, then `recomputeLedger` throws. The refund has
  `effects_applied_at: null`, and the order ledger still shows nothing refunded
  (`quantity_refunded` 0, `payment_status` unchanged).
- `order.service.js#recordOrderPayment`: the Payment document is created, then
  the order save throws. The order stays `pending_payment` while a succeeded
  Payment exists for it.

Refunds do not survive a rollback. Only the per-order refund lock uses
`findOneAndUpdate`/`updateOne` (without `runValidators`), so the lock is still
taken and released; the refund itself still reaches `recomputeLedger`'s save.

### Survives

- All reads: order list, order detail, invoice PDF, refund summary
  (`getRefundableSummary`), reports. Reads never validate.
- `Order.updateOne` / `findOneAndUpdate` without `runValidators` (only the
  refund lock helpers use these).
- Orders with no custom line are unaffected by the rollback.

### If a rollback is needed after custom orders exist

1. Count the affected orders first (read-only):
   `db.orders.countDocuments({ "items.is_custom": true })`.
   If it is 0, a full revert is safe.
2. Otherwise, revert everything except the `Order.js` schema hunk. Keep
   `product`'s conditional `required` and the `is_custom` field. They are inert
   without the rest of the feature: reverting the validator and the POS UI
   stops new custom lines from being created, and existing orders stay
   editable and refundable.
3. Do not assign placeholder product ids to custom lines to satisfy the
   validator. That would make them look like catalogue sales in reports and
   in the refund stock/listing lookups.
4. If the schema hunk must go anyway, treat every affected order as
   read-only until the hunk is restored. Block refunds, payments and edits on
   those orders, because the refund and payment paths leave the partial writes
   described above. Any refund or payment attempted in that window must be
   reconciled by hand.
