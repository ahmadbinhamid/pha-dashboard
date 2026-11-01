// services/upload-ref-migration.service.js
// Rewrites stored full upload URLs to bare file names, so domains can change.

const Tenant = require("../models/Tenant");
const User = require("../models/User");
const StorefrontSettings = require("../models/StorefrontSettings");
const MarketplaceListing = require("../models/MarketplaceListing");
const { toUploadRef, toRelativeUploadLinks } = require("../utils/uploadUrl");

const BATCH_SIZE = 500;
// Only rows still holding a URL with our /uploads/ path need rewriting.
const HAS_UPLOAD_URL = /\/uploads\//;

/** Field updates for one doc, or null when every field is already a ref. */
function refUpdates(doc, fields) {
  const set = {};
  for (const field of fields) {
    const ref = toUploadRef(doc[field]);
    if (ref !== doc[field]) set[field] = ref;
  }
  return Object.keys(set).length ? set : null;
}

function slideUpdates(doc) {
  let changed = false;
  const slides = doc.hero_slides.map((slide) => {
    const image_url = toUploadRef(slide.image_url);
    const mobile_image_url = toUploadRef(slide.mobile_image_url);
    if (image_url !== slide.image_url || mobile_image_url !== slide.mobile_image_url) changed = true;
    return { ...slide, image_url, mobile_image_url };
  });
  return changed ? { hero_slides: slides } : null;
}

function descriptionUpdates(doc) {
  const html = toRelativeUploadLinks(doc.description_override);
  return html !== doc.description_override ? { description_override: html } : null;
}

/** Cursor over matches, writing one bulk batch at a time unless dry run. */
async function rewrite(Model, filter, toSet, { dryRun, onChange }) {
  let ops = [];
  let changed = 0;
  const flush = async () => {
    if (!dryRun && ops.length) await Model.bulkWrite(ops, { ordered: false });
    ops = [];
  };
  for await (const doc of Model.find(filter).lean().cursor()) {
    const set = toSet(doc);
    if (!set) continue;
    changed += 1;
    onChange?.(Model.modelName, doc._id, set);
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });
    if (ops.length >= BATCH_SIZE) await flush();
  }
  await flush();
  return changed;
}

/** Logos, favicons, hero slides, avatars and channel description HTML. */
async function normalizeStoredUploadRefs({ dryRun = true, tenantId = null, onChange } = {}) {
  const scope = tenantId ? { tenant_id: tenantId } : {};
  const opts = { dryRun, onChange };
  const tenants = await rewrite(
    Tenant,
    { ...(tenantId && { _id: tenantId }), $or: [{ logo_url: HAS_UPLOAD_URL }, { favicon_url: HAS_UPLOAD_URL }] },
    (doc) => refUpdates(doc, ["logo_url", "favicon_url"]),
    opts,
  );
  const storefronts = await rewrite(
    StorefrontSettings,
    { ...scope, $or: [{ "hero_slides.image_url": HAS_UPLOAD_URL }, { "hero_slides.mobile_image_url": HAS_UPLOAD_URL }] },
    slideUpdates,
    opts,
  );
  const users = await rewrite(
    User,
    { ...scope, profile_image: HAS_UPLOAD_URL },
    (doc) => refUpdates(doc, ["profile_image"]),
    opts,
  );
  const listings = await rewrite(
    MarketplaceListing,
    { ...scope, description_override: /https?:\/\/[^"\s]*\/uploads\// },
    descriptionUpdates,
    opts,
  );
  return { tenants, storefronts, users, listings };
}

module.exports = { normalizeStoredUploadRefs };
