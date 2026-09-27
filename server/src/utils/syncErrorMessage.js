// utils/syncErrorMessage.js
// Turns stored channel errors (raw API JSON, long paragraphs) into a sentence.

// "upsert inventory_item failed: 400 {json}" as thrown by the eBay client.
const API_FAILURE = /^(.+?) failed: (\d{3})\s*([\s\S]*)$/;
const STOREFRONT_REQUIRED = /^No verified default domain/;
const STOREFRONT_REQUIRED_TEXT = "Google Shopping needs a verified storefront domain. Add one in Settings > Domains, then retry.";

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
    return body.errors.map((e) => e.longMessage || e.message).filter(Boolean);
  }
  return body?.error?.message ? [body.error.message] : [];
}

/** Readable text for a listing's sync_error; unknown text passes through. */
function readableSyncError(raw) {
  if (!raw) return raw;
  if (STOREFRONT_REQUIRED.test(raw)) return STOREFRONT_REQUIRED_TEXT;

  const match = raw.match(API_FAILURE);
  if (!match) return raw;
  const [, action, status, rest] = match;
  const messages = messagesFrom(parseJson(rest));
  if (messages.length) return [...new Set(messages)].join(" ");
  // HTML error pages or empty bodies carry nothing worth showing.
  return `${action.replace(/_/g, " ")} failed (HTTP ${status}).`;
}

module.exports = { readableSyncError };
