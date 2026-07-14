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

async function ensureUniqueSlug(Model, baseSlug, excludeId = null) {
  let slug = baseSlug;
  let counter = 2;

  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };

    const exists = await Model.findOne(query);
    if (!exists) return slug;

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

// ensureUniqueSlug checks then the caller inserts — not atomic, so two
// near-simultaneous creates for the same base slug (double-submit, retry,
// concurrent requests) can both pass the check before either commits, and
// the loser hits a duplicate-key error on the real unique index. Instead of
// trusting the pre-check alone, retry the whole check-then-create cycle on
// a genuine slug conflict — ensureUniqueSlug will see the just-committed
// competitor on the next attempt and bump the suffix further.
async function createWithUniqueSlug(Model, baseSlug, buildDoc, { maxAttempts = 5 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const slug = await ensureUniqueSlug(Model, baseSlug);
    try {
      return await Model.create(buildDoc(slug));
    } catch (err) {
      const isSlugConflict = err.code === 11000 && err.keyPattern && "slug" in err.keyPattern;
      if (!isSlugConflict || attempt === maxAttempts - 1) throw err;
    }
  }
}

module.exports = { generateSlug, ensureUniqueSlug, createWithUniqueSlug };
