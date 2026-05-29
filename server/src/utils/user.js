const PRIVATE_FIELDS = [
  "password",
  "otp",
  "otp_expiry",
  "password_reset_token",
  "password_reset_expiry",
  "deleted_at",
  "deleted_by",
];

const PUBLIC_SELECT = PRIVATE_FIELDS.map((f) => `-${f}`).join(" ");

function toPublicUser(doc) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  PRIVATE_FIELDS.forEach((k) => delete obj[k]);
  return obj;
}

function fullName(user) {
  return `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
}

module.exports = { PUBLIC_SELECT, toPublicUser, fullName };
