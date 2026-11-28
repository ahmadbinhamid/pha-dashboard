// services/campaign/campaign-delivery.service.js
// Renders and sends one campaign email; the campaign worker calls these.

const config = require("../../config");
const { sendEmail } = require("../email/mailer");
const { renderDocument } = require("../email/templateLoader");
const { getCompanyProfile } = require("../tenant-settings.service");
const { fillMergeTags } = require("../../utils/emailHtml");
const { isHardBounce } = require("../../utils/smtpBounce");
const contactService = require("./contact.service");
const { DEFAULT_LAYOUT } = require("./email-design.service");
const { CONTACT_STATUS, DELIVERY_RESULT } = require("../../constants/campaign.constants");

const TEST_RECIPIENT = Object.freeze({ first_name: "Alex", last_name: "Sample", email: "" });
const PROFILE_TTL_MS = 5 * 60 * 1000;
const PROFILE_CACHE_MAX = 100;

// One profile read per tenant per few minutes, not one per recipient.
const profileCache = new Map();

async function cachedCompanyProfile(tenantId) {
  const key = String(tenantId);
  const hit = profileCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.profile;
  const profile = await getCompanyProfile(tenantId);
  if (profileCache.size >= PROFILE_CACHE_MAX) profileCache.delete(profileCache.keys().next().value);
  profileCache.set(key, { profile, expires: Date.now() + PROFILE_TTL_MS });
  return profile;
}

function unsubscribeUrl(token) {
  return `${config.campaigns.publicApiUrl.replace(/\/$/, "")}/api/v1/campaigns/unsubscribe/${token}`;
}

// Spam Act 2003 wants the sender identified; address and phone where known.
function senderDetails(profile) {
  const address = profile.pickup_location?.address;
  return [profile.company_name, address, profile.phone].filter(Boolean).join(" · ");
}

/** Subject and full HTML document for one recipient. */
function renderCampaignEmail({ content, contact, profile, unsubscribe }) {
  const subject = fillMergeTags(content.subject, contact, { escape: false });
  const html = renderDocument(
    "campaign",
    {
      app_name: profile.company_name || config.emailBrand.appName,
      support_email: profile.email || null,
      preheader: fillMergeTags(content.preheader, contact, { escape: false }),
      body_html: fillMergeTags(content.body_html, contact),
      layout: content.layout || DEFAULT_LAYOUT,
      sender_details: senderDetails(profile),
      unsubscribe_url: unsubscribe,
    },
    subject,
  );
  return { subject, html };
}

/** Sends `content` to one contact; returns a DELIVERY_RESULT and permanence. */
async function deliverToContact(content, contactId) {
  const contact = await contactService.findContactForDelivery(contactId);
  // Unsubscribed between fan-out and send: honour it, don't count a failure.
  if (!contact || contact.status !== CONTACT_STATUS.SUBSCRIBED) return { result: DELIVERY_RESULT.SKIPPED };
  if (String(contact.tenant_id) !== String(content.tenant_id)) return { result: DELIVERY_RESULT.SKIPPED };

  const profile = await cachedCompanyProfile(contact.tenant_id);
  const unsubscribe = unsubscribeUrl(contact.unsubscribe_token);
  const { subject, html } = renderCampaignEmail({ content, contact, profile, unsubscribe });
  const sent = await sendEmail({
    tenantId: contact.tenant_id,
    fromName: profile.company_name || undefined,
    replyTo: profile.email || undefined,
    to: contact.email,
    subject,
    html,
    template: "campaign",
    // RFC 8058 one-click unsubscribe, required by Gmail and Yahoo bulk rules.
    headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
  if (sent.ok) await contactService.markContactEmailed(contact._id);
  else if (isHardBounce(sent)) await contactService.markContactBounced(contact._id, sent.response);
  return { result: sent.ok ? DELIVERY_RESULT.SENT : DELIVERY_RESULT.FAILED, permanent: sent.permanent };
}

/** Test send with sample merge values and a dead unsubscribe link. */
async function deliverTest(content, to) {
  const profile = await cachedCompanyProfile(content.tenant_id);
  const contact = { ...TEST_RECIPIENT, email: to };
  const { subject, html } = renderCampaignEmail({ content, contact, profile, unsubscribe: "#" });
  const sent = await sendEmail({
    tenantId: content.tenant_id,
    fromName: profile.company_name || undefined,
    replyTo: profile.email || undefined,
    to,
    subject: `[Test] ${subject}`,
    html,
    template: "campaign",
  });
  return sent;
}

/** Full HTML exactly as a sample recipient would get it, for the editor. */
async function renderPreview(content) {
  const profile = await cachedCompanyProfile(content.tenant_id);
  return renderCampaignEmail({ content, contact: TEST_RECIPIENT, profile, unsubscribe: "#" });
}

module.exports = { deliverToContact, deliverTest, renderPreview };
