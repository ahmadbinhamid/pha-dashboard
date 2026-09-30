import test from "node:test";
import assert from "node:assert/strict";
import { addCartLine, removeCartLine, setCartLineNote, setCartLineQuantity } from "./cartState.ts";
import { buildCustomCartItem } from "./customCartItem.ts";
import type { CartItem } from "@/types/cart";

// Identical content on purpose: rows must be told apart by key alone.
const VALUES = { title: "Fitting labour", price: "40", shipping: "20", discount: "" };

function cartWithTwoCustomLines() {
  const first = buildCustomCartItem(VALUES);
  const second = buildCustomCartItem(VALUES);
  let cart: CartItem[] = [];
  cart = addCartLine(cart, first).next;
  cart = addCartLine(cart, second).next;
  return { cart, first, second };
}

test("each custom line gets its own key, minted once and stored on the item", () => {
  const { cart, first, second } = cartWithTwoCustomLines();

  assert.match(first.key, /^custom:[0-9a-f-]{36}$/);
  assert.notEqual(first.key, second.key);
  assert.deepEqual(
    cart.map((i) => i.key),
    [first.key, second.key],
    "adding must keep the key it was given, never mint a new one",
  );
  assert.ok(cart.every((i) => i.is_custom && i.product_id === null && i.max_quantity === null));
});

test("changing one custom line's quantity leaves the other untouched", () => {
  const { cart, first, second } = cartWithTwoCustomLines();

  const next = setCartLineQuantity(cart, first.key, 5);
  assert.equal(next.find((i) => i.key === first.key)?.quantity, 5);
  assert.equal(next.find((i) => i.key === second.key)?.quantity, 1);
  assert.deepEqual(next.map((i) => i.key), [first.key, second.key], "keys survive edits");

  // No stock cap on custom lines.
  assert.equal(setCartLineQuantity(next, second.key, 999).find((i) => i.key === second.key)?.quantity, 999);
});

test("a note on one custom line doesn't touch the other", () => {
  const { cart, first, second } = cartWithTwoCustomLines();

  const next = setCartLineNote(cart, second.key, "  fit on Tuesday  ");
  assert.equal(next.find((i) => i.key === second.key)?.note, "fit on Tuesday");
  assert.equal(next.find((i) => i.key === first.key)?.note, null);
});

test("removing one custom line keeps the other with its edits", () => {
  const { cart, first, second } = cartWithTwoCustomLines();

  const edited = setCartLineQuantity(cart, first.key, 3);
  const afterRemove = removeCartLine(edited, second.key);
  assert.deepEqual(afterRemove.map((i) => [i.key, i.quantity]), [[first.key, 3]]);

  // Stepping the survivor to 0 removes it too, like the stepper's minus.
  assert.deepEqual(setCartLineQuantity(afterRemove, first.key, 0), []);
});

test("re-adding with an existing key increments that row instead of duplicating", () => {
  const { cart, first } = cartWithTwoCustomLines();

  const { next } = addCartLine(cart, first);
  assert.equal(next.length, 2);
  assert.equal(next.find((i) => i.key === first.key)?.quantity, 2);
});
