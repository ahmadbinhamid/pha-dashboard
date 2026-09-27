// utils/slug.js

function generateSlug(title) {
  return title
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureUniqueSlug(Model, baseSlug, excludeId = null, tenantId = null) {
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    if (tenantId) query.tenant_id = tenantId;

    // withDeleted: the unique index covers soft-deleted docs too, so a slug one holds is
    // genuinely taken even though the default filter hides it, or the retry below never converges.
    const exists = await Model.findOne(query).setOptions({ withDeleted: true });
    if (!exists) return slug;

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// check-then-insert isn't atomic, so two near-simultaneous creates can both pass the check
// before either commits; retry the whole cycle on a genuine conflict so the loser converges.
async function createWithUniqueSlug(Model, baseSlug, buildDoc, { maxAttempts = 5, tenantId = null } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const slug = await ensureUniqueSlug(Model, baseSlug, null, tenantId);
    try {
      return await Model.create(buildDoc(slug));
    } catch (err) {
      const isSlugConflict = err.code === 11000 && err.keyPattern && "slug" in err.keyPattern;
      if (!isSlugConflict || attempt === maxAttempts - 1) throw err;
    }
  }
}

// Same race as createWithUniqueSlug, but for renaming an existing document; retries the
// slug-then-save cycle instead of surfacing a confusing "slug already exists" error.
async function saveWithUniqueSlug(doc, Model, baseSlug, excludeId, { maxAttempts = 5, tenantId = null } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    doc.slug = await ensureUniqueSlug(Model, baseSlug, excludeId, tenantId);
    try {
      return await doc.save();
    } catch (err) {
      const isSlugConflict = err.code === 11000 && err.keyPattern && "slug" in err.keyPattern;
      if (!isSlugConflict || attempt === maxAttempts - 1) throw err;
    }
  }
}

module.exports = { generateSlug, ensureUniqueSlug, createWithUniqueSlug, saveWithUniqueSlug };
