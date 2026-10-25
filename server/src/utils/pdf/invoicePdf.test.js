// utils/pdf/invoicePdf.test.js
// Bill To shows only for an entered billing address, contact never drops.

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildInvoicePdfBuffer, partyBlockLines, itemChips, dueDateCells } = require("./invoicePdf");

const SHIPPING = { address: "1 Dock Rd", suburb: "Botany", state: "NSW", postcode: "2019" };
const BILLING = { address: "9 Office St", suburb: "Sydney", state: "NSW", postcode: "2000" };
const CUSTOMER = { name: "Jo Fix", company_name: null, phone: "0400 000 000", email: "jo@example.com" };
const CONTACT = ["Phone: 0400 000 000", "Email: jo@example.com"];

const order = (overrides = {}) => ({
  _id: "o1", invoice_number_prefix: "INV", invoice_number: 7, created_at: new Date("2026-01-02"),
  channel: "manual", status: "pending_payment", delivery_method: "delivery", customer: CUSTOMER,
  shipping_address: SHIPPING, billing_address: null,
  items: [{ name: "Brake pad", sku: "BP-1", unit_price: 11000, quantity: 1, discount_amount: 0 }],
  subtotal: 11000, discount_amount: 0, tax_amount: 1000, shipping_cost: 0, total: 11000,
  ...overrides,
});

test("no billing address: no Bill To, contact moves under Ship To", () => {
  const { billLines, shipLines } = partyBlockLines(order());
  assert.equal(billLines, null);
  assert.deepEqual(shipLines, ["1 Dock Rd", "Botany NSW 2019", ...CONTACT]);
});

test("an entered billing address keeps Bill To, with contact under it", () => {
  const { billLines, shipLines } = partyBlockLines(order({ billing_address: BILLING }));
  assert.deepEqual(billLines, ["9 Office St", "Sydney NSW 2000, Australia", ...CONTACT]);
  assert.deepEqual(shipLines, ["1 Dock Rd", "Botany NSW 2019"]);
});

test("pickup with no billing address keeps the collection line plus contact", () => {
  const { billLines, shipLines } = partyBlockLines(order({ delivery_method: "pickup", shipping_address: null }));
  assert.equal(billLines, null);
  assert.deepEqual(shipLines, ["Customer collection from the store address above.", ...CONTACT]);
});

test("missing phone or email adds no blank line", () => {
  const { shipLines } = partyBlockLines(order({ customer: { ...CUSTOMER, phone: null, email: null } }));
  assert.deepEqual(shipLines, ["1 Dock Rd", "Botany NSW 2019"]);
});

test("the PDF renders with and without a billing address", async () => {
  for (const billing_address of [null, BILLING]) {
    const pdf = await buildInvoicePdfBuffer(order({ billing_address }));
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  }
});

test("a business invoice names the billed rep under the business", () => {
  const customer = { ...CUSTOMER, company_name: "ABC Motors" };
  const { shipLines } = partyBlockLines(order({ customer }));
  assert.deepEqual(shipLines, ["1 Dock Rd", "Botany NSW 2019", "Attn: Jo Fix", ...CONTACT]);
});

test("line chips show condition then authenticity, none for custom lines", () => {
  assert.deepEqual(itemChips({ condition: "USED", authenticity: "Genuine" }), ["Used", "Genuine"]);
  assert.deepEqual(itemChips({ condition: "NEW", authenticity: null }), ["New"]);
  assert.deepEqual(itemChips({ condition: null, authenticity: null }), []);
});

test("account terms replace due on receipt with a dated due date", () => {
  assert.deepEqual(dueDateCells(order()), [["Due Date", "Due on receipt"]]);
  const cells = dueDateCells(order({ due_date: new Date("2026-01-16T00:00:00"), payment_terms_days: 14 }));
  assert.deepEqual(cells[1], ["Terms", "14-day account"]);
  assert.equal(cells[0][0], "Due Date");
  assert.notEqual(cells[0][1], "Due on receipt");
});

test("the PDF renders a business account order with chipped lines", async () => {
  const items = [{ name: "Pads", sku: "BP-1", condition: "USED", authenticity: "Genuine", unit_price: 1000, quantity: 1 }];
  const pdf = await buildInvoicePdfBuffer(
    order({ customer: { ...CUSTOMER, company_name: "ABC Motors" }, items, due_date: new Date(), payment_terms_days: 30 }),
  );
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
});
