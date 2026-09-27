import zxingWasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import type { BarcodeDetector } from "barcode-detector/ponyfill";

// Product tags are QR; the rest cover manufacturer labels typed into search.
const SCAN_FORMATS = ["qr_code", "code_128", "ean_13", "upc_a"] as const;

let detector: Promise<BarcodeDetector> | null = null;

/** Lazy, shared detector; the wasm is bundled so no CDN is contacted. */
export function getBarcodeDetector() {
  detector ??= import("barcode-detector/ponyfill").then(({ BarcodeDetector, prepareZXingModule }) => {
    prepareZXingModule({
      overrides: { locateFile: (path, prefix) => (path.endsWith(".wasm") ? zxingWasmUrl : prefix + path) },
    });
    return new BarcodeDetector({ formats: [...SCAN_FORMATS] });
  });
  return detector;
}
