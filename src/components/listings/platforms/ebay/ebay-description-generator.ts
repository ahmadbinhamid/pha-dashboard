import type { EbayListingFormState } from "@/types/marketplace";
import { PHA_LOGO_BASE64 } from "./ebay-template-logo";

const CONDITION_LABEL: Record<string, string> = {
  NEW: "Brand New",
  USED: "Used",
};

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function generateListingHtml(form: EbayListingFormState): string {
  const title = form.title_override.trim() || "Parts Hub Australia Product";
  const mpn = form.item_specifics.mpn.trim() || "—";
  const sku = form.store_sku.trim() || "—";
  const condition = CONDITION_LABEL[form.condition] ?? form.condition;
  const notes = form.condition_notes.trim() || "—";

  // Derive Make / Model and Year from fitment rows
  const validFitment = form.fitment.filter((r) => r.make.trim() || r.model.trim());

  const makeModelSet = new Set(
    validFitment.map((r) => [r.make, r.model].filter(Boolean).join(" ")),
  );
  const makeModel = makeModelSet.size > 0 ? [...makeModelSet].join(", ") : "—";

  const yearSet = new Set(
    validFitment.map((r) => {
      const from = r.year_from.trim();
      const to = r.year_to.trim();
      if (from && to) return `${from}–${to}`;
      return from || to;
    }).filter(Boolean),
  );
  const yearStr = yearSet.size > 0 ? [...yearSet].join(", ") : "—";

  const fitmentRows = validFitment.length > 0
    ? validFitment.map((r) => {
        const make = esc(r.make.trim());
        const model = esc(r.model.trim());
        const from = r.year_from.trim();
        const to = r.year_to.trim();
        const years = from && to ? ` ${from}–${to}` : from ? ` ${from}+` : to ? ` up to ${to}` : "";
        return `<li>${make}${make && model ? " " : ""}${model}${years}</li>`;
      }).join("\n        ")
    : "<li>Please contact us to verify fitment for your vehicle.</li>";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--g:#C5A059;--gh:#F9E29C;--gd:#8B6B3E;--bk:#000000;--tx:#F5F0E6;--tm:#B8A88A}
html,body{background:#000000}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.65;color:var(--tx);background:#000000;-webkit-text-size-adjust:100%}
img{max-width:100%;height:auto;display:block;background:#000000}
a{color:var(--gh);text-decoration:none}
header{background:#000000;border-bottom:3px solid var(--g);padding:20px 16px 16px;text-align:center;width:100%}
.logo{max-width:320px;width:100%;margin:0 auto 10px;background:#000000}
.tagline{font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gh);margin-bottom:12px}
.nav{list-style:none;display:flex;flex-wrap:wrap;justify-content:center;gap:6px}
.nav a{display:block;padding:7px 14px;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--gh);background:rgba(197,160,89,.1);border:1px solid rgba(197,160,89,.35);border-radius:4px}
main{max-width:960px;margin:0 auto;padding:16px 12px 28px}
section{background:var(--bk);border:1px solid rgba(197,160,89,.35);border-radius:8px;padding:18px;margin-bottom:16px}
h1{font-size:24px;font-weight:700;color:var(--gh);line-height:1.3;margin-bottom:8px}
h2{font-size:18px;font-weight:700;color:var(--bk);background:linear-gradient(135deg,var(--gd),var(--g),var(--gh));padding:11px 16px;margin:-18px -18px 16px;border-radius:8px 8px 0 0;letter-spacing:.5px;text-transform:uppercase}
h3{font-size:15px;font-weight:700;color:var(--gh);margin:18px 0 8px;padding-bottom:6px;border-bottom:1px solid rgba(197,160,89,.3)}
.desc{color:var(--tx);margin-bottom:14px}
ul.spec,ul.features,ul.fit,ul.policy{list-style:none;padding:0}
ul.spec li,ul.fit li,ul.policy li{position:relative;padding:9px 0 9px 0;border-bottom:1px solid rgba(197,160,89,.15);color:var(--tx)}
ul.spec li:last-child,ul.fit li:last-child,ul.policy li:last-child{border-bottom:none}
ul.fit li::before,ul.policy li::before{content:"";position:absolute;left:0;top:13px;width:10px;height:10px;background:var(--g);border-radius:50%}
ul.fit li,ul.policy li{padding-left:22px}
ul.spec li strong{color:var(--gh);display:inline-block;min-width:130px}
.note{font-size:13px;color:var(--tm);font-style:italic;margin-top:10px}
.cta{background:linear-gradient(135deg,var(--gd),var(--g));padding:16px;border-radius:8px;text-align:center;margin-top:16px}
.cta a{color:#000!important;font-size:16px;font-weight:700;text-decoration:none;display:inline-block;padding:10px 20px;border:2px solid var(--gh);border-radius:6px}
.services{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}
.svc{flex:1 1 140px;text-align:center;padding:14px 8px;background:var(--bk);border:1px solid rgba(197,160,89,.3);border-radius:6px}
.svc strong{display:block;font-size:12px;color:var(--gh);letter-spacing:.5px;text-transform:uppercase;line-height:1.4}
footer{background:var(--bk);border-top:3px solid var(--g);padding:22px 16px;text-align:center;margin-top:8px}
.fnav{list-style:none;display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-bottom:14px}
.fnav a{display:block;padding:8px 14px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--gh);border:1px solid rgba(197,160,89,.35);border-radius:4px}
.fstore{font-size:18px;font-weight:700;color:var(--gh);margin-bottom:6px}
.fhours{font-size:13px;color:var(--tm);margin-bottom:10px}
.fthanks{font-size:14px;color:var(--g);font-weight:600}
.tabs-wrap{margin-top:4px}
.tabs-wrap input{display:none}
.tabs{display:flex;flex-wrap:wrap;border:1px solid rgba(197,160,89,.35);border-radius:6px;overflow:hidden}
.tabs label{flex:1 1 auto;min-width:90px;padding:12px 8px;text-align:center;font-size:11px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--gh);background:#111;cursor:pointer;border-right:1px solid rgba(197,160,89,.2)}
.tabs label:last-child{border-right:none}
.tab-panel{display:none;padding:16px 0 0}
.tab-panel h3{margin-top:0}
#pha-t1:checked~.tabs label[for="pha-t1"],
#pha-t2:checked~.tabs label[for="pha-t2"],
#pha-t3:checked~.tabs label[for="pha-t3"],
#pha-t4:checked~.tabs label[for="pha-t4"],
#pha-t5:checked~.tabs label[for="pha-t5"]{background:linear-gradient(135deg,var(--gd),var(--g));color:#000}
#pha-t1:checked~.tab-panel-1,
#pha-t2:checked~.tab-panel-2,
#pha-t3:checked~.tab-panel-3,
#pha-t4:checked~.tab-panel-4,
#pha-t5:checked~.tab-panel-5{display:block}
@media(max-width:600px){
body{font-size:15px}h1{font-size:20px}h2{font-size:15px;padding:10px 14px;margin:-18px -18px 14px}
section{padding:14px}ul.spec li strong{display:block;min-width:0;margin-bottom:2px}
.svc{flex:1 1 100%}.tabs label{font-size:9px;padding:10px 4px;min-width:70px}
}
</style>
</head>
<body>

<header>
<img class="logo" src="${PHA_LOGO_BASE64}" alt="Parts Hub Australia — Premium Automotive Parts and Accessories">
<p class="tagline">Premium Automotive Parts &amp; Accessories</p>
<ul class="nav">
<li><a href="#">Store Home</a></li>
<li><a href="#">About Us</a></li>
<li><a href="#">Contact</a></li>
</ul>
</header>

<main>

<section>
<h1>${esc(title)}</h1>
</section>

<section>
<h2>Item Specifications</h2>
<ul class="spec">
<li><strong>Make / Model:</strong> ${esc(makeModel)}</li>
<li><strong>Year:</strong> ${esc(yearStr)}</li>
<li><strong>Part Number:</strong> ${esc(mpn)}</li>
<li><strong>Stock Number:</strong> ${esc(sku)}</li>
<li><strong>Condition:</strong> ${esc(condition)}</li>
<li><strong>Comments:</strong> ${esc(notes)}</li>
</ul>
</section>

<section>
<h2>Vehicle Fitment</h2>
<ul class="fit">
        ${fitmentRows}
</ul>
<p class="note">Please verify compatibility before purchasing. Message us with your VIN or registration details and we will confirm fitment for you.</p>
<div class="cta"><a href="#">Browse Our Complete Parts Collection</a></div>
</section>

<section>
<h2>Store Policies</h2>
<div class="tabs-wrap">
<input type="radio" id="pha-t1" name="pha-tabs" checked>
<input type="radio" id="pha-t2" name="pha-tabs">
<input type="radio" id="pha-t3" name="pha-tabs">
<input type="radio" id="pha-t4" name="pha-tabs">
<input type="radio" id="pha-t5" name="pha-tabs">
<div class="tabs">
<label for="pha-t1">General Info</label>
<label for="pha-t2">Shipping</label>
<label for="pha-t3">Payment</label>
<label for="pha-t4">Warranty</label>
<label for="pha-t5">About Us</label>
</div>
<div class="tab-panel tab-panel-1">
<h3>General Information</h3>
<ul class="policy">
<li>Business hours: Monday to Friday 8:30 AM – 5:00 PM, Saturday 9:00 AM – 1:00 PM, excluding public holidays.</li>
<li>Please confirm the item is correct and compatible with your vehicle before purchasing.</li>
<li>Provide your VIN or registration number and we will verify fitment for you.</li>
<li>All items are described as accurately as possible. Contact us if you need more details before buying.</li>
</ul>
</div>
<div class="tab-panel tab-panel-2">
<h3>Shipping &amp; Handling</h3>
<ul class="policy">
<li>Fast dispatch from Australia — orders packed and shipped promptly.</li>
<li>Same-day or next-business-day dispatch on most orders Monday to Friday.</li>
<li>Tracked shipping via Australia Post or courier with tracking provided on dispatch.</li>
<li>Combined shipping available — message us before checkout.</li>
<li>Australia-wide delivery; international shipping on selected items.</li>
</ul>
</div>
<div class="tab-panel tab-panel-3">
<h3>Payment</h3>
<ul class="policy">
<li>Payment at time of purchase through eBay checkout.</li>
<li>PayPal, credit and debit card, and Afterpay accepted where available.</li>
<li>Tax invoice provided with every purchase.</li>
</ul>
</div>
<div class="tab-panel tab-panel-4">
<h3>Warranty &amp; Returns</h3>
<ul class="policy">
<li>12-month warranty against manufacturing defects where applicable.</li>
<li>30-day return policy — item must be unused, in original packaging, and resalable.</li>
<li>Buyer pays return postage unless the item is faulty or incorrectly supplied.</li>
<li>Refund issued within 3 to 5 business days of receiving the returned item.</li>
<li>Contact us before returning so we can assist you promptly.</li>
</ul>
</div>
<div class="tab-panel tab-panel-5">
<h3>About Parts Hub Australia</h3>
<ul class="policy">
<li>Trusted Australian supplier of premium automotive parts and accessories.</li>
<li>Specialists in quality components for passenger vehicles, 4x4s, and light commercial vehicles.</li>
<li>Fast dispatch, honest descriptions, and professional customer service on every order.</li>
</ul>
</div>
</div>
</section>

<section>
<h2>Our Services</h2>
<p class="desc">Parts Hub Australia is your trusted supplier for premium automotive parts and accessories. Fast dispatch, quality guaranteed, and professional customer service on every order.</p>
<div class="services">
<div class="svc"><strong>Quality Parts</strong></div>
<div class="svc"><strong>Fast Dispatch</strong></div>
<div class="svc"><strong>Warranty on All Parts</strong></div>
<div class="svc"><strong>Nationwide Delivery</strong></div>
</div>
</section>

</main>

<footer>
<ul class="fnav">
<li><a href="#">Store Home</a></li>
<li><a href="#">About Us</a></li>
<li><a href="#">Contact Us</a></li>
</ul>
<p class="fstore">Parts Hub Australia</p>
<p class="fhours">Mon – Fri: 8:30 AM – 5:00 PM &nbsp;|&nbsp; Sat: 9:00 AM – 1:00 PM</p>
<p class="fthanks">Thank you for shopping with us — we appreciate your business!</p>
</footer>

</body>
</html>`;
}
