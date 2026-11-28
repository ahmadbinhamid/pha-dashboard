// utils/pickDefined.js

/** The listed fields that `input` actually sets, for partial updates. */
function pickDefined(input, fields) {
  return Object.fromEntries(fields.filter((f) => input[f] !== undefined).map((f) => [f, input[f]]));
}

module.exports = { pickDefined };
