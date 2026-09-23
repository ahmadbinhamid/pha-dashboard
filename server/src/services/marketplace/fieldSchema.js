// services/marketplace/fieldSchema.js
// Server-side enforcement of adapter fieldSchema rules (the UI only mirrors them).

const { FIELD_TYPE, STATIC_FIELD_OPTIONS, ENFORCED_OPTION_SOURCES } = require("../../constants/channelField.constants");

// status 400 so the circuit breaker treats it as a data problem.
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

/** Errors for effective `values`; `keys` limits which fields are checked. */
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

// Checks manifest.productConstraints against the effective title.
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

// Schema for the UI, with static option lists attached.
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
