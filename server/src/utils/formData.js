// utils/formData.js

function parseField(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function parseFormDataArrays(body) {
  return {
    attachments: parseField(body.attachments),
    categories: parseField(body.categories),
    tags: parseField(body.tags),
    related_products: parseField(body.related_products),
    choices: parseField(body.choices),
  };
}

function toBool(val) {
  return val === "true" || val === true;
}

module.exports = { parseField, parseFormDataArrays, toBool };
