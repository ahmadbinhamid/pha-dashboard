// scripts/resyncStaleEbayListings.ts
//
// Regenerates description_override (real product photo embedded, see
// ebayDescriptionGenerator.ts) for every eBay listing whose synced_at is
// NOT today, then queues each one for a real push to eBay — same as
// clicking "Push to eBay" on every stale listing in the dashboard, but in
// bulk. Exists because description_override is built CLIENT-SIDE and only
// updated when a listing is resaved (see ListingsPage.tsx's pushMutation) —
// a listing nobody has touched since before some description-generator
// change stays stuck on old/incorrect HTML forever otherwise.
//
// Must be run with tsx, NOT plain node — it imports the actual frontend
// TypeScript description generator (ebayDescriptionGenerator.ts /
// listingToForm.ts) directly, so this always generates EXACTLY the same
// HTML the dashboard itself would, never a re-implementation that can drift
// out of sync with it. Run from the REPO ROOT (not server/) so the "@/"
// alias resolves against the frontend's own tsconfig.json.
//
// THIS QUEUES REAL PUSHES TO LIVE EBAY LISTINGS. Dry run by default.
//
// Usage (from repo root):
//   npx tsx server/scripts/resyncStaleEbayListings.ts             # dry run
//   npx tsx server/scripts/resyncStaleEbayListings.ts --write      # apply
//   npx tsx server/scripts/resyncStaleEbayListings.ts --write --limit=20   # cap how many get queued, e.g. to test on a handful first
//   npx tsx server/scripts/resyncStaleEbayListings.ts --write --delay-ms=500  # pause between each queued push (default 250ms) — gentler on eBay's rate limits for a large batch

import { listingToForm, getListingFallbackImageUrl } from "@/lib/marketplace/listingToForm";
import { generateListingHtml } from "@/components/listings/platforms/ebay/ebayDescriptionGenerator";
import type { EbayListing } from "@/types/marketplace";

require("dotenv").config();
const path = require("path");

const SERVER_ROOT = path.resolve(__dirname, "..");
const mongoose = require(path.join(SERVER_ROOT, "node_modules/mongoose"));
const config = require(path.join(SERVER_ROOT, "src/config"));
require(path.join(SERVER_ROOT, "src/models")); // registers every model so populate() can resolve refs
const MarketplaceListing = require(path.join(SERVER_ROOT, "src/models/MarketplaceListing"));
const Tenant = require(path.join(SERVER_ROOT, "src/models/Tenant"));
const { enqueueEbayJob } = require(path.join(SERVER_ROOT, "src/queues/ebay.queue"));
const { MARKETPLACE_PLATFORM } = require(path.join(SERVER_ROOT, "src/constants/marketplace.constants"));

const WRITE = process.argv.includes("--write");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;
const delayArg = process.argv.find((a) => a.startsWith("--delay-ms="));
const DELAY_MS = delayArg ? parseInt(delayArg.split("=")[1], 10) : 250;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  await mongoose.connect(config.mongoUri);
  console.log(`Connected to MongoDB (${config.mongoUri}) — mode: ${WRITE ? "WRITE" : "DRY RUN"}`);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // "not including today's date" = synced_at is either never set, or older
  // than today's midnight. A listing synced earlier today is left alone —
  // it's already carrying today's generator output.
  const filter = {
    platform: MARKETPLACE_PLATFORM.EBAY,
    $or: [{ synced_at: null }, { synced_at: { $lt: startOfToday } }],
  };

  const total = await MarketplaceListing.countDocuments(filter);
  console.log(`Stale eBay listings (synced_at not today, or never synced): ${total}`);
  if (LIMIT !== Infinity) console.log(`Capped to first ${LIMIT} via --limit`);

  const listings = await MarketplaceListing.find(filter)
    .sort({ synced_at: 1 })
    .limit(LIMIT === Infinity ? 0 : LIMIT)
    .populate({ path: "product", populate: { path: "attachments" } })
    .populate({ path: "variant", populate: { path: "attachments" } })
    .populate("photo_overrides");

  const tenantCache = new Map<string, { company_name: string | null; logo_url: string | null }>();
  async function getTenantBranding(tenantId: string) {
    if (tenantCache.has(tenantId)) return tenantCache.get(tenantId)!;
    const tenant = await Tenant.findById(tenantId).select("company_name logo_url").lean();
    const branding = { company_name: tenant?.company_name ?? null, logo_url: tenant?.logo_url ?? null };
    tenantCache.set(tenantId, branding);
    return branding;
  }

  let regenerated = 0;
  let unchanged = 0;
  let queued = 0;
  let failed = 0;

  for (const listing of listings) {
    try {
      const branding = await getTenantBranding(String(listing.tenant_id));
      const vehicle =
        listing.product && typeof listing.product === "object" ? listing.product.vehicle ?? null : null;
      const form = listingToForm(listing as unknown as EbayListing);
      const fallbackImageUrl = getListingFallbackImageUrl(listing as unknown as EbayListing);

      const newDescription = generateListingHtml(form, vehicle, branding.company_name, branding.logo_url, {
        embedImages: true,
        fallbackImageUrl,
      });

      const productTitle =
        listing.product && typeof listing.product === "object" ? listing.product.title : "(no product)";

      if (newDescription === listing.description_override) {
        unchanged++;
        console.log(`  [unchanged] ${listing._id} — ${productTitle}`);
        continue;
      }

      regenerated++;
      console.log(`  [regenerate] ${listing._id} — ${productTitle}`);

      if (WRITE) {
        listing.description_override = newDescription;
        await listing.save();
        await enqueueEbayJob("sync_listing", { listingId: listing._id.toString() });
        queued++;
        await sleep(DELAY_MS);
      }
    } catch (err) {
      failed++;
      console.error(`  [FAILED] ${listing._id}:`, (err as Error).message);
    }
  }

  console.log(`\nDescription regenerated: ${regenerated}`);
  console.log(`Already up to date: ${unchanged}`);
  console.log(`Failed: ${failed}`);
  if (WRITE) {
    console.log(`Queued for real eBay push: ${queued}`);
  } else {
    console.log("\nDry run only — nothing was saved or queued. Re-run with --write to apply.");
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("resyncStaleEbayListings failed:", err);
  process.exit(1);
});
