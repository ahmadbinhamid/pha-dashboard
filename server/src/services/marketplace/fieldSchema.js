// services/marketplace/fieldSchema.js
// Generic enforcement of an adapter's fieldSchema (manifest.fieldSchema). Each descriptor:
//   { key, label, type, required, helpText, optionsSource?, group? }
// The browser validates the same schema for UX; this is where correctness lives.

const { FIELD_TYPE, STATIC_FIELD_OPTIONS, ENFORCED_OPTION_SOURCES } = require("../../constants/channelField.constants");

// status 400 => circuitBreaker.js treats it as a per-item data problem, never a transport failure.
class ChannelFieldValidationError extends Error {
  constructor(platform, errors, sku = null) {
    super(`[${platform}] ${sku ? `${sku}: ` : ""}${errors.map((e) => e.message).join(" ")}`);
    this.name = "ChannelFieldValidationError";
    this.status = 400;
    this.code = "FIELD_VALIDATION";
    this.errors = errors;
  }
}

function isEmpty(value) {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function checkDescriptor(descriptor, value) {
  if (isEmpty(value)) return descriptor.required ? `${descriptor.label} is required.` : null;
  if (descriptor.type === FIELD_TYPE.NUMBER && !Number.isFinite(Number(value))) return `${descriptor.label} must be a number.`;
  if (descriptor.type === FIELD_TYPE.BOOLEAN && typeof value !== "boolean") return `${descriptor.label} must be true or false.`;
  if (ENFORCED_OPTION_SOURCES.includes(descriptor.optionsSource)) {
    const allowed = STATIC_FIELD_OPTIONS[descriptor.optionsSource].map((o) => o.value);
    if (!allowed.includes(value)) return `${descriptor.label} must be one of: ${allowed.join(", ")}.`;
  }
  return null;
}

/**
 * Checks effective `values` against `schema`; `keys` limits the check to those fields.
 * @returns {{ field: string, message: string }[]}
 */
function validateFieldValues(schema, values, { keys = null } = {}) {
  const errors = [];
  for (const descriptor of schema) {
    if (keys && !keys.includes(descriptor.key)) continue;
    const message = checkDescriptor(descriptor, values[descriptor.key]);
    if (message) errors.push({ field: descriptor.key, message });
  }
  return errors;
}

function assertFieldValues(platform, schema, values, { keys = null, sku = null } = {}) {
  const errors = validateFieldValues(schema, values, { keys });
  if (errors.length) throw new ChannelFieldValidationError(platform, errors, sku);
}

// manifest.productConstraints, e.g. { title: { maxLength: 80 } }, checked on the EFFECTIVE value.
function assertProductConstraints(platform, constraints, resolved) {
  const maxTitle = constraints?.title?.maxLength;
  if (maxTitle && (resolved.title || "").length > maxTitle) {
    const source = resolved.listing?.title_override ? "Title override" : "Product title";
    throw new ChannelFieldValidationError(
      platform,
      [{ field: "title_override", message: `${source} is ${resolved.title.length} characters — ${platform} allows ${maxTitle}.` }],
      resolved.sku,
    );
  }
}

// Schema as served to the frontend: static option lists attached so it can render selects.
function withStaticOptions(schema = []) {
  return schema.map((d) => (STATIC_FIELD_OPTIONS[d.optionsSource] ? { ...d, options: STATIC_FIELD_OPTIONS[d.optionsSource] } : d));
}

module.exports = {
  ChannelFieldValidationError,
  validateFieldValues,
  assertFieldValues,
  assertProductConstraints,
  withStaticOptions,
};
