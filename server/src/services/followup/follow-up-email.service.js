// services/followup/follow-up-email.service.js
// Renders a follow-up email: the design, rating stars per product, footer.

const config = require("../../config");
const { renderDocument } = require("../email/templateLoader");
const { getCompanyProfile } = require("../tenant-settings.service");
const { getDefaultStorefrontHost } = require("../domain.service");
const { designLayout } = require("../campaign/email-design.service");
const { fillMergeTags, escapeHtml } = require("../../utils/emailHtml");
const { formatOrderNumber } = require("../../utils/orderNumberFormat");
const { withAttachmentUrls } = require("../../utils/attachment");
const { RATING, MAX_RATED_ITEMS } = require("../../constants/followup.constants");

const STAR_COLOR = "#f59e0b";
const SAMPLE_ITEMS = Object.freeze([
  { _id: "sample1", name: "Ceramic brake pads (front)" },
  { _id: "sample2", name: "Brake rotor 300mm" },
]);

/** Store name, contact and website for one tenant, read once per send. */
async function storeContext(tenantId) {
  const [profile, host] = await Promise.all([getCompanyProfile(tenantId), getDefaultStorefrontHost(tenantId)]);
  return { profile, storefrontUrl: (host ? `https://${host}` : config.emailBrand.storefrontUrl).replace(/\/$/, "") };
}

// One line per product, duplicates merged; custom lines are rated too.
function ratableItems(order) {
  const seen = new Set();
  const items = [];
  for (const item of order.items ?? []) {
    const key = String(item.product?._id ?? item.product ?? item.name);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items.slice(0, MAX_RATED_ITEMS);
}

function starLinks(url) {
  const stars = [];
  for (let n = RATING.MIN; n <= RATING.MAX; n += 1) {
    const href = escapeHtml(`${url}&rating=${n}`);
    stars.push(
      `<a href="${href}" title="${n} out of ${RATING.MAX}" style="color:${STAR_COLOR};font-size:28px;line-height:1;text-decoration:none;padding:0 2px;">&#9733;</a>`,
    );
  }
  return stars.join("");
}

function itemImage(item) {
  const src = withAttachmentUrls(item.product?.attachments ?? [])[0]?.url;
  return src ? `<img src="${escapeHtml(src)}" alt="" width="56" style="display:block;width:56px;height:56px;object-fit:cover;border-radius:6px;border:0;" />` : "";
}

/** Product rows with clickable stars; each opens the feedback page. */
function ratingBlock(items, feedbackUrl) {
  const rows = items.map((item) => {
    const url = `${feedbackUrl}?item=${encodeURIComponent(String(item._id))}`;
    const image = itemImage(item);
    const details =
      `<td valign="middle" style="padding:10px 0;font-size:15px;"${image ? "" : ' colspan="2"'}>` +
      `<div style="margin-bottom:4px;">${escapeHtml(item.name)}</div>${starLinks(url)}</td>`;
    // No photo: the name takes the full width instead of leaving a gap.
    const photo = image ? `<td width="64" valign="middle" style="padding:10px 8px 10px 0;">${image}</td>` : "";
    return `<tr>${photo}${details}</tr>`;
  });
  return (
    '<div style="font-size:16px;font-weight:bold;margin-bottom:4px;">How would you rate your order?</div>' +
    '<div style="font-size:13px;color:#888888;margin-bottom:8px;">Tap a star, it takes a few seconds.</div>' +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join("")}</table>`
  );
}

/** Subject and HTML for one order, or a sample when order is null. */
async function renderFollowUpEmail({ followUp, order, token, tenantId }) {
  const { profile, storefrontUrl } = await storeContext(tenantId);
  const orderNumber = order ? formatOrderNumber(order.order_number_prefix, order.order_number) : "PH-1042";
  const [firstName = "", ...rest] = String(order?.customer?.name ?? "Alex Sample").trim().split(/\s+/);
  const person = { first_name: firstName, last_name: rest.join(" "), email: order?.customer?.email ?? "" };
  const fill = (text, escape) => fillMergeTags(String(text || "").replace(/{{\s*order_number\s*}}/g, orderNumber), person, { escape });
  const items = order ? ratableItems(order) : SAMPLE_ITEMS;
  const base = `${storefrontUrl}/feedback/${token ?? "preview"}`;
  const subject = fill(followUp.subject, false);
  const html = renderDocument(
    "followUp",
    {
      app_name: profile.company_name || config.emailBrand.appName,
      support_email: profile.email || null,
      preheader: fill(followUp.preheader, false),
      body_html: fill(followUp.body_html, true),
      rating_html: followUp.ask_for_rating && items.length ? ratingBlock(items, base) : null,
      layout: designLayout(followUp.design),
      order_number: orderNumber,
      sender_details: [profile.company_name, profile.pickup_location?.address, profile.phone].filter(Boolean).join(" · "),
      opt_out_url: token ? `${config.campaigns.publicApiUrl.replace(/\/$/, "")}/api/v1/feedback/opt-out/${token}` : "#",
    },
    subject,
  );
  return { subject, html, profile };
}

module.exports = { renderFollowUpEmail, ratableItems };
