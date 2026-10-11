// utils/imageDimensions.js
// Pixel size of a local PNG/JPEG from its header; null for anything else.

const fs = require("fs/promises");

// Enough for a JPEG's SOF marker after typical EXIF/ICC segments.
const MAX_HEAD_BYTES = 256 * 1024;

function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47 || buf.toString("latin1", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), format: "png" };
}

// SOF0-SOF15 carry dimensions; C4 (DHT), C8 (JPG) and CC (DAC) don't.
function isStartOfFrame(marker) {
  return marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
}

function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) return null;
    const marker = buf[offset + 1];
    // Fill bytes and standalone markers have no length field.
    if (marker === 0xff || (marker >= 0xd0 && marker <= 0xd9) || marker === 0x01) {
      offset += marker === 0xff ? 1 : 2;
      continue;
    }
    const length = buf.readUInt16BE(offset + 2);
    if (isStartOfFrame(marker)) {
      return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5), format: "jpeg" };
    }
    offset += 2 + length;
  }
  return null;
}

/** { width, height, format } of a PNG/JPEG buffer, else null. */
function imageSizeFromBuffer(buf) {
  return pngSize(buf) ?? jpegSize(buf);
}

/** Reads only the file head; null when missing, unreadable or not PNG/JPEG. */
async function readImageSize(filePath) {
  let handle;
  try {
    handle = await fs.open(filePath, "r");
    const buf = Buffer.alloc(MAX_HEAD_BYTES);
    const { bytesRead } = await handle.read(buf, 0, MAX_HEAD_BYTES, 0);
    return imageSizeFromBuffer(buf.subarray(0, bytesRead));
  } catch {
    return null;
  } finally {
    await handle?.close();
  }
}

module.exports = { imageSizeFromBuffer, readImageSize };
