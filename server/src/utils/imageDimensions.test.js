// utils/imageDimensions.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const { imageSizeFromBuffer, readImageSize } = require("./imageDimensions");

// SOI, an APP0 segment, then SOF0 with height 480 and width 640.
function jpeg() {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0, 0x02, 0x80, 0x03,
  ]);
}

test("jpeg: reads width and height from the SOF marker", () => {
  assert.deepEqual(imageSizeFromBuffer(jpeg()), { width: 640, height: 480, format: "jpeg" });
});

test("png: reads IHDR; anything else is null", () => {
  const png = Buffer.alloc(24);
  png.writeUInt32BE(0x89504e47, 0);
  png.write("IHDR", 12, "latin1");
  png.writeUInt32BE(1200, 16);
  png.writeUInt32BE(900, 20);
  assert.deepEqual(imageSizeFromBuffer(png), { width: 1200, height: 900, format: "png" });
  assert.equal(imageSizeFromBuffer(Buffer.from("GIF89a....")), null);
});

test("readImageSize: a missing file is null, never a throw", async () => {
  assert.equal(await readImageSize("/nonexistent/file.png"), null);
});
