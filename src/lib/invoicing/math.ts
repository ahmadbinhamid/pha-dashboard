export const GST_RATE = 0.1;

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * AU retail default: prices are GST-inclusive.
 * For any GST-inclusive amount T:
 *   subtotal = T / 1.1
 *   gst = T - subtotal
 */
export function splitGstIncluded(totalInclGst: number) {
  const subtotal = totalInclGst / (1 + GST_RATE);
  const gst = totalInclGst - subtotal;
  return { subtotal: round2(subtotal), gst: round2(gst), total: round2(totalInclGst) };
}

