import type { CreateEbayListingResult, EbayUploaderFormPayload } from "@/services/ebay/types";
import {
  ebayApiBase,
  ebayDefaultCategoryId,
  ebayMarketplaceId,
  ebayPublishDryRun,
} from "@/services/ebay/env";

function currencyForMarketplace(marketplaceId: string): string {
  if (marketplaceId.includes("EBAY_US")) return "USD";
  if (marketplaceId.includes("EBAY_GB")) return "GBP";
  if (marketplaceId.includes("EBAY_DE") || marketplaceId.includes("EBAY_FR") || marketplaceId.includes("EBAY_IT")) return "EUR";
  return "AUD";
}

type PolicyBundle = {
  fulfillmentPolicyId: string;
  paymentPolicyId: string;
  returnPolicyId: string;
};

async function ebayJson<T>(path: string, accessToken: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: T | null; text: string }> {
  const url = `${ebayApiBase()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: T | null = null;
  try {
    body = text ? (JSON.parse(text) as T) : null;
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body, text };
}

async function fetchPolicyIds(accessToken: string, marketplaceId: string): Promise<PolicyBundle | { error: string }> {
  const [ful, pay, ret] = await Promise.all([
    ebayJson<{ fulfillmentPolicies?: Array<{ fulfillmentPolicyId: string }> }>(
      `/sell/account/v1/fulfillment_policy?marketplace_id=${encodeURIComponent(marketplaceId)}`,
      accessToken,
    ),
    ebayJson<{ paymentPolicies?: Array<{ paymentPolicyId: string }> }>(
      `/sell/account/v1/payment_policy?marketplace_id=${encodeURIComponent(marketplaceId)}`,
      accessToken,
    ),
    ebayJson<{ returnPolicies?: Array<{ returnPolicyId: string }> }>(
      `/sell/account/v1/return_policy?marketplace_id=${encodeURIComponent(marketplaceId)}`,
      accessToken,
    ),
  ]);

  if (!ful.ok || !ful.body?.fulfillmentPolicies?.[0]?.fulfillmentPolicyId) {
    return { error: `Fulfillment policy: ${ful.status} ${ful.text.slice(0, 400)}` };
  }
  if (!pay.ok || !pay.body?.paymentPolicies?.[0]?.paymentPolicyId) {
    return { error: `Payment policy: ${pay.status} ${pay.text.slice(0, 400)}` };
  }
  if (!ret.ok || !ret.body?.returnPolicies?.[0]?.returnPolicyId) {
    return { error: `Return policy: ${ret.status} ${ret.text.slice(0, 400)}` };
  }

  return {
    fulfillmentPolicyId: ful.body.fulfillmentPolicies[0].fulfillmentPolicyId,
    paymentPolicyId: pay.body.paymentPolicies[0].paymentPolicyId,
    returnPolicyId: ret.body.returnPolicies[0].returnPolicyId,
  };
}

async function fetchMerchantLocationKey(accessToken: string): Promise<string | { error: string }> {
  const res = await ebayJson<{ locations?: Array<{ merchantLocationKey?: string; name?: string }> }>(
    "/sell/inventory/v1/location",
    accessToken,
  );
  if (!res.ok || !res.body?.locations?.length) {
    return { error: `Inventory locations: ${res.status} ${res.text.slice(0, 400)}` };
  }
  const loc = res.body.locations[0];
  const key = loc.merchantLocationKey ?? loc.name;
  if (!key) return { error: "No merchantLocationKey on first location." };
  return key;
}

function buildCompatibilityDescription(form: EbayUploaderFormPayload): string {
  const lines: string[] = [];
  if (form.description.trim()) lines.push(form.description.trim());
  const structured = form.fitmentRows
    .filter((r) => r.make.trim() || r.model.trim() || r.year.trim() || r.engine.trim())
    .map((r) => [r.make, r.model, r.year, r.engine].filter(Boolean).join(" · "));
  if (structured.length) {
    lines.push("", "Vehicle compatibility (structured):", ...structured.map((s) => `• ${s}`));
  }
  if (form.compatibilityText.trim()) {
    lines.push("", "Additional compatibility:", form.compatibilityText.trim());
  }
  return lines.join("\n");
}

/**
 * Creates / replaces an inventory item, creates a fixed-price offer, and publishes it.
 * Import only from Route Handlers (uses server env and should not ship to the client bundle).
 */
export async function createEbayListing(params: {
  accessToken: string;
  form: EbayUploaderFormPayload;
  /** Must be public HTTPS URLs that eBay can retrieve when live publishing. */
  imageUrls: string[];
}): Promise<CreateEbayListingResult> {
  const { accessToken, form } = params;
  const sku = form.sku.trim();
  if (!sku) {
    return { ok: false, code: "VALIDATION", message: "SKU is required." };
  }

  const qty = Math.max(1, Math.floor(Number(form.quantity) || 0));
  const price = Number(form.price);
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, code: "VALIDATION", message: "Price must be a positive number." };
  }

  if (ebayPublishDryRun()) {
    return {
      ok: true,
      dryRun: true,
      sku,
      warnings: [
        "EBAY_PUBLISH_DRY_RUN is enabled (default). Set EBAY_PUBLISH_DRY_RUN=false, EBAY_DEFAULT_CATEGORY_ID, and public HTTPS image URLs for live listings.",
      ],
    };
  }

  const categoryId = form.ebayCategoryId?.trim() || ebayDefaultCategoryId();
  if (!categoryId) {
    return {
      ok: false,
      code: "CONFIG",
      message: "Set EBAY_DEFAULT_CATEGORY_ID or enter an eBay category ID on the form.",
    };
  }

  const images = params.imageUrls.filter((u) => /^https:\/\//i.test(u.trim()));
  if (images.length === 0) {
    return {
      ok: false,
      code: "VALIDATION",
      message: "At least one public HTTPS image URL is required for live eBay listings.",
    };
  }

  const marketplaceId = ebayMarketplaceId();
  const policies = await fetchPolicyIds(accessToken, marketplaceId);
  if ("error" in policies) {
    return { ok: false, code: "EBAY_ACCOUNT", message: policies.error };
  }

  const loc = await fetchMerchantLocationKey(accessToken);
  if (typeof loc !== "string") {
    return { ok: false, code: "EBAY_LOCATION", message: loc.error };
  }

  const description = buildCompatibilityDescription(form);
  const brand = form.brand.trim() || "Unbranded";
  const mpn = form.oemNumber.trim() || sku;

  const inventoryBody = {
    availability: {
      shipToLocationAvailability: {
        quantity: qty,
      },
    },
    condition: form.condition,
    product: {
      title: form.title.trim().slice(0, 80),
      description,
      imageUrls: images.slice(0, 12),
      aspects: {
        Brand: [brand],
        "Manufacturer Part Number": [mpn],
      },
    },
  };

  const put = await ebayJson<unknown>(`/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, accessToken, {
    method: "PUT",
    body: JSON.stringify(inventoryBody),
  });
  if (!put.ok) {
    return {
      ok: false,
      code: "EBAY_INVENTORY",
      message: `Inventory item failed (${put.status})`,
      details: put.body ?? put.text,
    };
  }

  const offerBody = {
    sku,
    marketplaceId,
    format: "FIXED_PRICE",
    categoryId,
    listingDescription: description,
    merchantLocationKey: loc,
    listingPolicies: {
      fulfillmentPolicyId: policies.fulfillmentPolicyId,
      paymentPolicyId: policies.paymentPolicyId,
      returnPolicyId: policies.returnPolicyId,
    },
    pricingSummary: {
      price: {
        currency: currencyForMarketplace(marketplaceId),
        value: String(price),
      },
    },
    quantity: { value: qty },
  };

  const offer = await ebayJson<{ offerId?: string; listingId?: string }>(
    "/sell/inventory/v1/offer",
    accessToken,
    { method: "POST", body: JSON.stringify(offerBody) },
  );
  if (!offer.ok || !offer.body?.offerId) {
    return {
      ok: false,
      code: "EBAY_OFFER",
      message: `Create offer failed (${offer.status})`,
      details: offer.body ?? offer.text,
    };
  }

  const offerId = offer.body.offerId;
  const pub = await ebayJson<unknown>(`/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`, accessToken, {
    method: "POST",
  });
  if (!pub.ok) {
    return {
      ok: false,
      code: "EBAY_PUBLISH",
      message: `Publish failed (${pub.status})`,
      details: pub.body ?? pub.text,
    };
  }

  return {
    ok: true,
    dryRun: false,
    sku,
    offerId,
    listingId: offer.body.listingId,
  };
}
