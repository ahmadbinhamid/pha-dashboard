const PRIVATE_FIELDS = [
  "password",
  "otp",
  "otp_expiry",
  "password_reset_token",
  "password_reset_expiry",
  "deleted_at",
  "deleted_by",
];

/** Mongoose `.select()` string that excludes all internal/sensitive fields */
const PUBLIC_SELECT = PRIVATE_FIELDS.map((f) => `-${f}`).join(" ");

/** Strip sensitive fields from a Mongoose document before sending to client */
function toPublicUser(doc) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  PRIVATE_FIELDS.forEach((k) => delete obj[k]);
  return obj;
}

module.exports = { PUBLIC_SELECT, toPublicUser };
