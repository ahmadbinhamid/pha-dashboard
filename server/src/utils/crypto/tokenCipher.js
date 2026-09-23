// utils/crypto/tokenCipher.js
// Reversible, app-level encryption for stored third-party credentials that must be read back
// in plaintext to make API calls, unlike passwords. AES-256-GCM authenticates, so a tampered
// ciphertext fails to decrypt rather than returning garbage.

const crypto = require("crypto");
const config = require("../../config");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended for GCM

function getKey() {
  const key = config.security.encryptionKey;
  if (!key) throw new Error("ENCRYPTION_KEY is not set — cannot encrypt/decrypt stored credentials");
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes, hex-encoded (64 hex characters) — e.g. `openssl rand -hex 32`");
  }
  return buf;
}

// Returns null in, null out — encrypting "nothing configured yet" should stay null.
function encrypt(plaintext) {
  if (plaintext == null) return { ciphertext: null, iv: null, tag: null };

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

function decrypt({ ciphertext, iv, tag }) {
  if (!ciphertext || !iv || !tag) return null;

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

// ── ciphertext packing ───────────────────────────────────────────────────────
// Packs {ciphertext, iv, tag} into one delimited string for ChannelConnection's single *_ct
// field per token slot. Base64 never contains ".", so joining/splitting on it is safe.
// ebay.settings.service.js has its own private copy of these two functions predating this
// extraction, deliberately left untouched; new platforms use this shared copy instead.
function packCiphertext({ ciphertext, iv, tag }) {
  if (!ciphertext) return null;
  return `${iv}.${tag}.${ciphertext}`;
}

function unpackCiphertext(packed) {
  if (!packed) return { ciphertext: null, iv: null, tag: null };
  const [iv, tag, ciphertext] = packed.split(".");
  return { ciphertext, iv, tag };
}

module.exports = { encrypt, decrypt, packCiphertext, unpackCiphertext };
