// utils/syncErrorMessage.js
// Turns stored channel errors (raw API JSON, long paragraphs) into a sentence.

// "upsert inventory_item failed: 400 {json}" as thrown by the eBay client.
const API_FAILURE = /^(.+?) failed: (\d{3})\s*([\s\S]*)$/;
const { CHANNEL_REMEDY_LOCATION } = require("../constants/channel.constants");

const STOREFRONT_REQUIRED = /^No verified default domain/;
// Channel name as the resolver writes it: "… — <name> requires a real …".
const STOREFRONT_CHANNEL = /— (.+?) requires a real/;

// NOTE: names the channel from the raw text, else a neutral "This channel".
function storefrontRequiredText(raw) {
  const name = raw.match(STOREFRONT_CHANNEL)?.[1] ?? "This channel";
  return `${name} needs a verified storefront domain. Add one in ${CHANNEL_REMEDY_LOCATION.DOMAINS.place}, then retry.`;
}

// eBay codes whose own text gives nothing to act on.
const EBAY_ERROR_HINTS = {
  25001: "eBay couldn't process this item. Check its package size, weight and photos, then retry.",
};

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// eBay: { errors: [{ message, longMessage }] }; Google: { error: { message } }.
function messagesFrom(body) {
  if (Array.isArray(body?.errors)) {
    return body.errors.map((e) => EBAY_ERROR_HINTS[e.errorId] || e.longMessage || e.message).filter(Boolean);
  }
  return body?.error?.message ? [body.error.message] : [];
}

/** Readable text for a listing's sync_error; unknown text passes through. */
function readableSyncError(raw) {
  if (!raw) return raw;
  if (STOREFRONT_REQUIRED.test(raw)) return storefrontRequiredText(raw);

  const match = raw.match(API_FAILURE);
  if (!match) return raw;
  const [, action, status, rest] = match;
  const messages = messagesFrom(parseJson(rest));
  if (messages.length) return [...new Set(messages)].join(" ");
  // HTML error pages or empty bodies carry nothing worth showing.
  return `${action.replace(/_/g, " ")} failed (HTTP ${status}).`;
}

module.exports = { readableSyncError };
