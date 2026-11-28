// utils/http/htmlPage.js
// Minimal standalone HTML pages for links opened straight from an email.

const { escapeHtml } = require("../emailHtml");

const PAGE_STYLE =
  "body{margin:0;font-family:Arial,sans-serif;background:#f5f5f5;color:#222}" +
  ".card{max-width:440px;margin:12vh auto;background:#fff;border-radius:12px;padding:32px;" +
  "box-shadow:0 2px 12px rgba(0,0,0,.06);text-align:center}" +
  "h1{font-size:20px;margin:0 0 12px}p{color:#555;line-height:1.5;margin:0 0 20px}" +
  "button{background:#f97316;color:#fff;border:0;border-radius:8px;padding:12px 20px;" +
  "font-size:15px;cursor:pointer}";

/** A centred card with a heading, message and optional single-button form. */
function renderSimplePage({ title, heading, message, form }) {
  const formHtml = form
    ? `<form method="post" action="${escapeHtml(form.action)}"><button type="submit">${escapeHtml(form.label)}</button></form>`
    : "";
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    `<meta name="robots" content="noindex"><title>${escapeHtml(title)}</title>` +
    `<style>${PAGE_STYLE}</style></head><body><div class="card">` +
    `<h1>${escapeHtml(heading)}</h1><p>${escapeHtml(message)}</p>${formHtml}` +
    "</div></body></html>"
  );
}

module.exports = { renderSimplePage };
