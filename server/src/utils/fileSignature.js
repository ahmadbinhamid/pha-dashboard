// utils/fileSignature.js
// Magic-byte checks so a file's real content must match its claimed type.

const fs = require("fs/promises");

// Enough bytes for every signature below (the longest reads offset 8..12).
const HEAD_BYTES = 16;

const ascii = (buf, start, end) => buf.subarray(start, end).toString("latin1");
const startsWith = (buf, bytes) => bytes.every((b, i) => buf[i] === b);

const SIGNATURES = Object.freeze({
  jpeg: (b) => startsWith(b, [0xff, 0xd8, 0xff]),
  png: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]),
  gif: (b) => ascii(b, 0, 4) === "GIF8",
  webp: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP",
  pdf: (b) => ascii(b, 0, 4) === "%PDF",
  zip: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]),
  ole: (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0]),
  isoMedia: (b) => ascii(b, 4, 8) === "ftyp",
  webm: (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]),
  avi: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "AVI ",
});

/** First HEAD_BYTES of a file on disk (shorter if the file is smaller). */
async function readFileHead(filePath) {
  const handle = await fs.open(filePath, "r");
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    const { bytesRead } = await handle.read(buf, 0, HEAD_BYTES, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** Whether `head` matches the named signature; unknown names never do. */
function matchesSignature(signature, head) {
  const check = SIGNATURES[signature];
  return Boolean(check && head.length >= 4 && check(head));
}

/** Reads a file's head and checks it against the named signature. */
async function fileMatchesSignature(filePath, signature) {
  return matchesSignature(signature, await readFileHead(filePath));
}

module.exports = { readFileHead, matchesSignature, fileMatchesSignature };
