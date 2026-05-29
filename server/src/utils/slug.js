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

module.exports = { generateSlug, ensureUniqueSlug };
