import type { EbayListingFormState } from "@/types/marketplace";
import type { ProductVehicle } from "@/types/product";

const CONDITION_LABEL: Record<string, string> = {
  NEW: "Brand New · Sealed",
  USED: "Used",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// vehicle comes from the PRODUCT's own `vehicle` field, fetched fresh by the
// caller (never a copy stored on the listing/form) — this is what guarantees
// Technical Specifications always matches the Product page and is never
// affected by the listing's own (unrelated) Vehicle Fitment compatibility list.
export function generateListingHtml(
  form: EbayListingFormState,
  vehicle: ProductVehicle | null | undefined,
  // This tenant's own branding (TenantSettings.company_name) — every tenant
  // shares this one generator, so nothing here may hardcode a specific
  // tenant's name. No logo_url param — see headerLogo below for why.
  businessName?: string | null,
): string {
  const business = esc(businessName?.trim() || "Your Store");
  // eBay renders the description HTML in a sandboxed context that blocks
  // images hosted on third-party domains (confirmed live — eBay's own
  // Inventory API photo gallery works fine since eBay re-hosts those on
  // i.ebayimg.com; a hotlinked <img src="https://<our-domain>/..."> here
  // always renders as a broken icon regardless of the URL being reachable).
  // Text-only per-tenant fallback instead — never a hotlinked <img>.
  const headerLogo = `<div style="font-family:Georgia,serif;font-size:26px;color:#f8e19b;letter-spacing:1px;">${business}</div>`;

  const title = esc(form.title_override.trim() || `${businessName?.trim() || "Store"} Product`);
  const make = esc(vehicle?.make?.trim() || "—");
  const model = esc(vehicle?.model?.trim() || "—");
  const series = esc(vehicle?.model_code?.trim() || "—");
  const yrFrom = vehicle?.year_from != null ? String(vehicle.year_from) : "";
  const yrTo = vehicle?.year_to != null ? String(vehicle.year_to) : "";
  const yearRange = esc(yrFrom && yrTo ? `${yrFrom} – ${yrTo}` : yrFrom ? `${yrFrom} – Present` : "—");
  const mpn = esc(form.item_specifics.mpn.trim() || "—");
  const stockNumber = esc(form.store_sku.trim() || "—");

  const spnArr = (form.item_specifics.superseded_part_number || []).filter((s) => s.trim());
  const superseded = esc(spnArr.length > 0 ? spnArr.join(", ") : "—");

  const authenticity = esc(form.item_specifics.authenticity?.trim() || "—");
  const warranty = esc(form.item_specifics.warranty?.trim() || "—");
  const condition = esc(CONDITION_LABEL[form.condition] ?? form.condition);
  const notes = esc(form.condition_notes.trim() || "—");

  const validFitment = form.fitment.filter((r) => r.make.trim() || r.model.trim());

  const fitmentRows = validFitment.length > 0
    ? validFitment.map((r, i) => {
        const rowBg = i % 2 === 1 ? "background:#0e0e0e;" : "";
        const mk = esc(r.make.trim());
        const md = esc(r.model.trim());
        const cd = esc(r.model_code?.trim() || "—");
        const from = r.year_from.trim();
        const to = r.year_to.trim();
        const yearRange = from && to ? `${from} – ${to}` : from ? `${from} – Present` : to ? `up to ${to}` : "—";
        return `<tr style="${rowBg}">
        <td style="padding:14px 16px;font-family:Georgia,serif;font-size:14px;color:#f0e8d8;border-bottom:1px solid #2a2520;">${mk}</td>
        <td style="padding:14px 16px;font-family:Georgia,serif;font-size:14px;color:#d1c5b4;border-bottom:1px solid #2a2520;">${md}</td>
        <td style="padding:14px 16px;font-family:'Courier New',monospace;font-size:13px;color:#d1c5b4;border-bottom:1px solid #2a2520;">${cd}</td>
        <td style="padding:14px 16px;font-family:Georgia,serif;font-size:14px;color:#d1c5b4;border-bottom:1px solid #2a2520;">${esc(yearRange)}</td>
      </tr>`;
      }).join("\n")
    : `<tr>
        <td colspan="4" style="padding:14px 16px;font-family:Georgia,serif;font-size:14px;color:#8a8070;text-align:center;">Please contact us to verify fitment for your vehicle.</td>
      </tr>`;

  // Never hotlink here — eBay renders the description in a sandboxed context
  // that blocks images from any third-party domain (confirmed on a live
  // listing), so `<img src="https://<our-domain>/...">` always shows a
  // broken icon regardless of the URL being reachable. The real product
  // photo already displays correctly via eBay's own native gallery (see
  // ebay.api.service.js#resolveImageUrls, a separate Inventory API path that
  // eBay re-hosts on i.ebayimg.com) — this placeholder is description-only.
  const imageCell = `<div style="width:100%;padding-top:75%;background:#1a1a1a;position:relative;"><span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;font-size:11px;color:#8a8070;letter-spacing:2px;">NO IMAGE</span></div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style type="text/css">
  .pha-wrap{font-family:Georgia,'Times New Roman',serif;background:#0a0a0a;color:#e5e2e1;max-width:1100px;margin:0 auto;border:1px solid #c5a059;}
  .pha-sec{padding:32px 40px;}
  .pha-inner{padding:40px;}
  /* Header row */
  .pha-hdr-tbl{width:100%;border-collapse:collapse;}
  .pha-hdr-logo{vertical-align:middle;}
  .pha-hdr-badge{vertical-align:middle;text-align:right;}
  /* Trust bar */
  .pha-trust-tbl{width:100%;border-collapse:collapse;background:#111111;border-bottom:1px solid #2a2520;}
  .pha-trust-cell{width:25%;text-align:center;padding:20px 12px;border-right:1px solid #2a2520;}
  .pha-trust-cell:last-child{border-right:none;}
  /* Main 2-col */
  .pha-main-tbl{width:100%;border-collapse:collapse;}
  .pha-col-specs{width:56%;vertical-align:top;padding-right:24px;}
  .pha-col-img{width:44%;vertical-align:top;}
  /* Policies 2-col */
  .pha-pol-tbl{width:100%;border-collapse:collapse;}
  .pha-pol-left{width:50%;vertical-align:top;padding-right:14px;}
  .pha-pol-right{width:50%;vertical-align:top;padding-left:14px;}
  /* Fitment table scroll */
  .pha-fit-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .pha-fit-tbl{min-width:400px;width:100%;border-collapse:collapse;background:#141414;border:1px solid #2a2520;}
  @media screen and (max-width:620px){
    .pha-sec{padding:20px 16px !important;}
    .pha-inner{padding:20px 16px !important;}
    /* Header — must block all three levels */
    .pha-hdr-tbl,.pha-hdr-tbl tr{display:block !important;width:100% !important;}
    .pha-hdr-logo{display:block !important;width:100% !important;}
    .pha-hdr-badge{display:block !important;width:100% !important;text-align:left !important;padding-top:12px !important;}
    /* Trust bar — 4 cells become 2×2 */
    .pha-trust-tbl,.pha-trust-tbl tr{display:block !important;font-size:0;}
    .pha-trust-cell{display:inline-block !important;width:50% !important;vertical-align:top !important;font-size:10px !important;box-sizing:border-box !important;border-right:none !important;border-bottom:1px solid #2a2520 !important;}
    /* Main 2-col — block all three levels */
    .pha-main-tbl,.pha-main-tbl tr{display:block !important;width:100% !important;}
    .pha-col-specs{display:block !important;width:100% !important;padding-right:0 !important;box-sizing:border-box !important;}
    .pha-col-img{display:block !important;width:100% !important;padding-top:20px !important;}
    /* Policies 2-col — block all three levels */
    .pha-pol-tbl,.pha-pol-tbl tr{display:block !important;width:100% !important;}
    .pha-pol-left{display:block !important;width:100% !important;padding-right:0 !important;}
    .pha-pol-right{display:block !important;width:100% !important;padding-left:0 !important;padding-top:16px !important;}
    h1.pha-title{font-size:20px !important;}
    h2.pha-h2{font-size:18px !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#000;">

<div class="pha-wrap">

  <div class="pha-sec" style="background:linear-gradient(180deg,#1a1a1a 0%,#0a0a0a 100%);border-bottom:2px solid #c5a059;">
    <table class="pha-hdr-tbl" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="pha-hdr-logo">${headerLogo}</td>
        <td class="pha-hdr-badge">
          <div style="font-family:Arial,sans-serif;font-size:10px;color:#8a8070;letter-spacing:2px;">AUTHORISED RESELLER</div>
          <div style="font-family:Arial,sans-serif;font-size:11px;color:#c5a059;letter-spacing:1px;margin-top:4px;">&#9733; &#9733; &#9733; &#9733; &#9733;</div>
          <div style="font-family:Arial,sans-serif;font-size:9px;color:#8a8070;letter-spacing:2px;margin-top:4px;">98.6% POSITIVE FEEDBACK</div>
        </td>
      </tr>
    </table>
  </div>

  <table class="pha-trust-tbl" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td class="pha-trust-cell">
        <div style="font-family:Arial,sans-serif;font-size:10px;color:#e9c176;letter-spacing:2px;font-weight:bold;">AUSTRALIAN SELLER</div>
        <div style="font-family:Arial,sans-serif;font-size:9px;color:#8a8070;margin-top:4px;">Local stock &amp; support</div>
      </td>
      <td class="pha-trust-cell">
        <div style="font-family:Arial,sans-serif;font-size:10px;color:#e9c176;letter-spacing:2px;font-weight:bold;">FAST DISPATCH</div>
        <div style="font-family:Arial,sans-serif;font-size:9px;color:#8a8070;margin-top:4px;">Same-day shipping</div>
      </td>
      <td class="pha-trust-cell">
        <div style="font-family:Arial,sans-serif;font-size:10px;color:#e9c176;letter-spacing:2px;font-weight:bold;">QUALITY GUARANTEED</div>
        <div style="font-family:Arial,sans-serif;font-size:9px;color:#8a8070;margin-top:4px;">12 month warranty</div>
      </td>
      <td class="pha-trust-cell">
        <div style="font-family:Arial,sans-serif;font-size:10px;color:#e9c176;letter-spacing:2px;font-weight:bold;">TRACKED SHIPPING</div>
        <div style="font-family:Arial,sans-serif;font-size:9px;color:#8a8070;margin-top:4px;">Australia-wide</div>
      </td>
    </tr>
  </table>

  <div class="pha-sec" style="background:linear-gradient(135deg,#1a1611 0%,#0a0a0a 60%,#0a0a0a 100%);border-bottom:1px solid #2a2520;">
    <h1 class="pha-title" style="font-family:Georgia,serif;font-size:28px;line-height:1.25;color:#f8e19b;margin:0 0 16px 0;font-weight:normal;letter-spacing:0.5px;">${title}</h1>
    <div style="width:60px;height:2px;background:#c5a059;margin-top:8px;"></div>
  </div>

  <div class="pha-inner" style="background:#0e0e0e;">
    <table class="pha-main-tbl" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td class="pha-col-specs">
          <h2 class="pha-h2" style="font-family:Georgia,serif;font-size:22px;color:#e9c176;margin:0 0 4px 0;font-weight:normal;letter-spacing:1px;">Technical Specifications</h2>
          <div style="width:40px;height:2px;background:#c5a059;margin-bottom:24px;"></div>
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#141414;border:1px solid #2a2520;">
            <tr>
              <td style="padding:14px 18px;border-bottom:1px solid #2a2520;border-right:1px solid #2a2520;width:50%;">
                <div style="font-family:Arial,sans-serif;font-size:9px;color:#8a8070;letter-spacing:3px;margin-bottom:6px;">MAKE</div>
                <div style="font-family:Georgia,serif;font-size:15px;color:#f0e8d8;">${make}</div>
              </td>
              <td style="padding:14px 18px;border-bottom:1px solid #2a2520;">
                <div style="font-family:Arial,sans-serif;font-size:9px;color:#8a8070;letter-spacing:3px;margin-bottom:6px;">MODEL</div>
                <div style="font-family:Georgia,serif;font-size:15px;color:#f0e8d8;">${model}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 18px;border-bottom:1px solid #2a2520;border-right:1px solid #2a2520;">
                <div style="font-family:Arial,sans-serif;font-size:9px;color:#8a8070;letter-spacing:3px;margin-bottom:6px;">SERIES</div>
                <div style="font-family:Georgia,serif;font-size:15px;color:#f0e8d8;">${series}</div>
              </td>
              <td style="padding:14px 18px;border-bottom:1px solid #2a2520;">
                <div style="font-family:Arial,sans-serif;font-size:9px;color:#8a8070;letter-spacing:3px;margin-bottom:6px;">YEAR RANGE</div>
                <div style="font-family:Georgia,serif;font-size:15px;color:#f0e8d8;">${yearRange}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 18px;border-bottom:1px solid #2a2520;border-right:1px solid #2a2520;background:#1a1611;">
                <div style="font-family:Arial,sans-serif;font-size:9px;color:#c5a059;letter-spacing:3px;margin-bottom:6px;">MANUFACTURER PART NUMBER (MPN)</div>
                <div style="font-family:'Courier New',monospace;font-size:16px;color:#f8e19b;font-weight:bold;letter-spacing:1px;">${mpn}</div>
              </td>
              <td style="padding:14px 18px;border-bottom:1px solid #2a2520;background:#1a1611;">
                <div style="font-family:Arial,sans-serif;font-size:9px;color:#c5a059;letter-spacing:3px;margin-bottom:6px;">STOCK NUMBER</div>
                <div style="font-family:'Courier New',monospace;font-size:16px;color:#f8e19b;font-weight:bold;letter-spacing:1px;">${stockNumber}</div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding:14px 18px;border-bottom:1px solid #2a2520;">
                <div style="font-family:Arial,sans-serif;font-size:9px;color:#8a8070;letter-spacing:3px;margin-bottom:6px;">SUPERSEDED PART NO.</div>
                <div style="font-family:'Courier New',monospace;font-size:13px;color:#d1c5b4;">${superseded}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 18px;border-bottom:1px solid #2a2520;border-right:1px solid #2a2520;">
                <div style="font-family:Arial,sans-serif;font-size:9px;color:#8a8070;letter-spacing:3px;margin-bottom:6px;">AUTHENTICITY</div>
                <div style="font-family:Georgia,serif;font-size:14px;color:#f0e8d8;">${authenticity}</div>
              </td>
              <td style="padding:14px 18px;border-bottom:1px solid #2a2520;">
                <div style="font-family:Arial,sans-serif;font-size:9px;color:#8a8070;letter-spacing:3px;margin-bottom:6px;">CONDITION</div>
                <div style="font-family:Georgia,serif;font-size:14px;color:#f0e8d8;">${condition}</div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding:14px 18px;border-bottom:1px solid #2a2520;">
                <div style="font-family:Arial,sans-serif;font-size:9px;color:#8a8070;letter-spacing:3px;margin-bottom:6px;">PRODUCT NOTE</div>
                <div style="font-family:Georgia,serif;font-size:14px;color:#d1c5b4;line-height:1.6;font-style:italic;">${notes}</div>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding:14px 18px;background:#1a1611;">
                <span style="font-family:Arial,sans-serif;font-size:10px;color:#c5a059;letter-spacing:3px;">WARRANTY</span>
                <span style="font-family:Georgia,serif;font-size:14px;color:#f8e19b;margin-left:12px;">${warranty}</span>
              </td>
            </tr>
          </table>
        </td>
        <td class="pha-col-img">
          <div style="background:#000000;border:1px solid #c5a059;padding:8px;">
            ${imageCell}
          </div>
        </td>
      </tr>
    </table>
  </div>

  <div class="pha-inner" style="background:linear-gradient(180deg,#0a0a0a 0%,#0e0e0e 100%);border-top:1px solid #2a2520;">
    <h2 class="pha-h2" style="font-family:Georgia,serif;font-size:22px;color:#e9c176;margin:0 0 4px 0;font-weight:normal;letter-spacing:1px;">Vehicle Fitment</h2>
    <div style="width:40px;height:2px;background:#c5a059;margin-bottom:24px;"></div>
    <div class="pha-fit-scroll">
      <table class="pha-fit-tbl" cellpadding="0" cellspacing="0" border="0">
        <tr style="background:#1a1611;">
          <td style="padding:14px 16px;font-family:Arial,sans-serif;font-size:10px;color:#c5a059;letter-spacing:3px;border-bottom:1px solid #c5a059;">MAKE</td>
          <td style="padding:14px 16px;font-family:Arial,sans-serif;font-size:10px;color:#c5a059;letter-spacing:3px;border-bottom:1px solid #c5a059;">MODEL</td>
          <td style="padding:14px 16px;font-family:Arial,sans-serif;font-size:10px;color:#c5a059;letter-spacing:3px;border-bottom:1px solid #c5a059;">SERIES</td>
          <td style="padding:14px 16px;font-family:Arial,sans-serif;font-size:10px;color:#c5a059;letter-spacing:3px;border-bottom:1px solid #c5a059;">YEAR RANGE</td>
        </tr>
        ${fitmentRows}
      </table>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;background:#1a1611;border:1px solid #c5a059;">
      <tr>
        <td style="padding:24px;">
          <div style="font-family:Arial,sans-serif;font-size:10px;color:#c5a059;letter-spacing:4px;margin-bottom:8px;">VIN VERIFICATION SERVICE</div>
          <div style="font-family:Georgia,serif;font-size:14px;color:#d1c5b4;line-height:1.7;">
            Please confirm the compatibility table above matches your vehicle before purchasing.
            <strong style="color:#f8e19b;">Unsure?</strong> Message us with your VIN or registration and we will verify fitment for you, free of charge.
          </div>
        </td>
      </tr>
    </table>
  </div>

  <div class="pha-inner" style="background:#0e0e0e;border-top:1px solid #2a2520;">
    <h2 class="pha-h2" style="font-family:Georgia,serif;font-size:22px;color:#e9c176;margin:0 0 4px 0;font-weight:normal;letter-spacing:1px;">Store Policies</h2>
    <div style="width:40px;height:2px;background:#c5a059;margin-bottom:28px;"></div>
    <table class="pha-pol-tbl" cellpadding="0" cellspacing="0" border="0">
      <tr valign="top">
        <td class="pha-pol-left">
          <div style="background:#141414;border:1px solid #2a2520;border-top:2px solid #c5a059;padding:24px;margin-bottom:16px;">
            <div style="font-family:Georgia,serif;font-size:16px;color:#e9c176;margin-bottom:14px;">Shipping &amp; Dispatch</div>
            <div style="font-family:Georgia,serif;font-size:13px;color:#d1c5b4;line-height:1.7;">&#183; Orders dispatched within 24 hours of cleared payment<br>&#183; Nationwide delivery available across Australia<br>&#183; Real-time tracking provided for every shipment<br>&#183; Signature on delivery for high-value items</div>
          </div>
          <div style="background:#141414;border:1px solid #2a2520;border-top:2px solid #c5a059;padding:24px;">
            <div style="font-family:Georgia,serif;font-size:16px;color:#e9c176;margin-bottom:14px;">Warranty &amp; Returns</div>
            <div style="font-family:Georgia,serif;font-size:13px;color:#d1c5b4;line-height:1.7;">&#183; 30-day return policy &mdash; unused, original packaging<br>&#183; Buyer pays return postage unless faulty / incorrect<br>&#183; Refunds processed within 3&ndash;5 business days<br>&#183; Contact us before returning so we can assist</div>
          </div>
        </td>
        <td class="pha-pol-right">
          <div style="background:#141414;border:1px solid #2a2520;border-top:2px solid #c5a059;padding:24px;margin-bottom:16px;">
            <div style="font-family:Georgia,serif;font-size:16px;color:#e9c176;margin-bottom:14px;">Secure Payment</div>
            <div style="font-family:Georgia,serif;font-size:13px;color:#d1c5b4;line-height:1.7;">&#183; Managed Payments via eBay AU<br>&#183; Visa, Mastercard, PayPal, Apple Pay<br>&#183; Full Tax Invoice supplied with every order<br>&#183; Buy Now, Pay Later available</div>
          </div>
          <div style="background:#141414;border:1px solid #2a2520;border-top:2px solid #c5a059;padding:24px;">
            <div style="font-family:Georgia,serif;font-size:16px;color:#e9c176;margin-bottom:14px;">About ${business}</div>
            <div style="font-family:Georgia,serif;font-size:13px;color:#d1c5b4;line-height:1.7;">Specialist supplier of premium automotive components. Based in Australia, serving professional workshops and enthusiasts with mechanical excellence and uncompromising service.</div>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <div class="pha-sec" style="background:linear-gradient(180deg,#0a0a0a 0%,#0e0e0e 100%);border-top:2px solid #c5a059;text-align:center;">
    <div style="font-family:Georgia,serif;font-size:18px;color:#e9c176;font-style:italic;letter-spacing:1px;margin-bottom:8px;">Thank you for shopping with us</div>
    <div style="font-family:Arial,sans-serif;font-size:10px;color:#8a8070;letter-spacing:4px;">&mdash; YOUR BUSINESS IS APPRECIATED &mdash;</div>
    <div style="margin-top:24px;font-family:Arial,sans-serif;font-size:10px;color:#c5a059;letter-spacing:3px;">
      &#9733; &#9733; &#9733; &#9733; &#9733; &nbsp;&nbsp; ${business.toUpperCase()} &nbsp;&nbsp; &#9733; &#9733; &#9733; &#9733; &#9733;
    </div>
  </div>

</div>
</body>
</html>`;
}
