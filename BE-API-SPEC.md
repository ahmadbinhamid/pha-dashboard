# Backend API Specification — Parts Hub Australia

This document captures every server-side endpoint that was removed from the Next.js project. Implement these in the **separate Node.js backend** and call them from the frontend. All paths are relative to the Node.js base URL (configured via `NEXT_PUBLIC_API_URL`).

---

## eBay Uploader Tool

Base path: `/api/tools/ebay`

### GET `/api/tools/ebay/status`

Returns the current eBay OAuth configuration and connection state.

**Response**
```json
{
  "oauthConfigured": true,
  "livePublishConfigured": true,
  "dryRun": false,
  "connected": true
}
```

| Field | Type | Description |
|---|---|---|
| `oauthConfigured` | boolean | `EBAY_CLIENT_ID` + `EBAY_CLIENT_SECRET` env vars are set |
| `livePublishConfigured` | boolean | All required env vars for live publishing are set (client + redirect + tokens) |
| `dryRun` | boolean | Whether the backend will actually POST to eBay or just simulate |
| `connected` | boolean | A valid OAuth token is stored for the linked eBay account |

---

### GET `/api/tools/ebay/connect`

Initiates the eBay OAuth 2.0 authorization code flow. Redirects the browser to the eBay consent screen. After authorization eBay redirects to the configured callback URL.

**Query params:** none  
**Response:** `302 Redirect → eBay consent page`

**After successful OAuth**, eBay redirects back to the frontend at:
```
/tools/ebay-uploader?ebay=connected
```
On failure:
```
/tools/ebay-uploader?ebay_error=<reason>
```

**Env vars required**
```
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
EBAY_REDIRECT_URI=        # must match the RuName registered in eBay Developer Portal
EBAY_OAUTH_SCOPE=         # e.g. https://api.ebay.com/oauth/api_scope/sell.inventory
```

---

### POST `/api/tools/ebay/disconnect`

Revokes the stored eBay OAuth token and clears the session/cookie.

**Request body:** none  
**Response**
```json
{ "ok": true }
```

---

### POST `/api/tools/ebay/publish`

Creates or updates an eBay listing via the eBay Inventory API.

**Request body** (`application/json`)
```json
{
  "title": "OEM front brake pads — W205",
  "sku": "PPG-001234",
  "oemNumber": "A0004211010",
  "brand": "Mercedes-Benz",
  "condition": "NEW",
  "price": "149.00",
  "quantity": "5",
  "description": "Fitment, warranty, shipping notes…",
  "ebayCategoryId": "33559",
  "imageUrls": [
    "https://cdn.example.com/part-front.jpg",
    "https://cdn.example.com/part-back.jpg"
  ],
  "fitmentRows": [
    { "make": "Mercedes-Benz", "model": "C-Class", "year": "2018", "engine": "2.0T" }
  ],
  "compatibilityText": "Also fits W204 C-Class 2012-2014"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | eBay listing title, max 80 chars |
| `sku` | string | yes | Unique seller SKU |
| `oemNumber` | string | no | OEM part number |
| `brand` | string | no | Part brand / manufacturer |
| `condition` | string | yes | One of: `NEW`, `LIKE_NEW`, `USED_EXCELLENT`, `USED_GOOD`, `USED_ACCEPTABLE`, `FOR_PARTS_OR_NOT_WORKING` |
| `price` | string | yes | Decimal string, e.g. `"149.00"` (AUD) |
| `quantity` | string | yes | Integer string |
| `description` | string | no | Plain text or basic HTML |
| `ebayCategoryId` | string | no | Falls back to `EBAY_DEFAULT_CATEGORY_ID` env var |
| `imageUrls` | string[] | no | Public HTTPS URLs eBay will download; first is primary |
| `fitmentRows` | object[] | no | Structured vehicle compatibility |
| `compatibilityText` | string | no | Free-text compatibility, appended to description |

**Success response**
```json
{
  "ok": true,
  "listingId": "123456789012",
  "offerId": "offer_abc123",
  "dryRun": false
}
```

**Error response** (`4xx` / `5xx`)
```json
{
  "ok": false,
  "error": "Human-readable reason",
  "details": {}
}
```

**Env vars required (live publishing)**
```
EBAY_CLIENT_ID=
EBAY_CLIENT_SECRET=
EBAY_REFRESH_TOKEN=       # obtained after OAuth flow
EBAY_MARKETPLACE_ID=      # e.g. EBAY_AU
EBAY_DEFAULT_CATEGORY_ID= # fallback category, e.g. 33559 (auto parts)
EBAY_FULFILLMENT_POLICY_ID=
EBAY_PAYMENT_POLICY_ID=
EBAY_RETURN_POLICY_ID=
```

---

## Frontend integration

The frontend currently stubs all API calls and shows "Backend not connected" toasts. To wire up:

1. Set `NEXT_PUBLIC_API_URL=https://your-node-backend.example.com` in `.env.local`
2. Replace the stub functions in [src/modules/ebay-uploader/components/EbayUploaderClient.tsx](src/modules/ebay-uploader/components/EbayUploaderClient.tsx):

| Stub location | Replace with |
|---|---|
| `refreshStatus` callback (line ~53) | `fetch(\`${process.env.NEXT_PUBLIC_API_URL}/api/tools/ebay/status\`)` |
| `publish` function (line ~218) | `fetch(\`${process.env.NEXT_PUBLIC_API_URL}/api/tools/ebay/publish\`, { method: "POST", body: JSON.stringify(payload) })` |
| `disconnect` function (line ~231) | `fetch(\`${process.env.NEXT_PUBLIC_API_URL}/api/tools/ebay/disconnect\`, { method: "POST" })` |
| Connect link (eBay OAuth redirect) | `window.location.href = \`${process.env.NEXT_PUBLIC_API_URL}/api/tools/ebay/connect\`` |

---

## Future endpoints (not yet implemented in FE)

These are anticipated based on the ERP data model. Define as needed when wiring up the Node.js BE.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/inventory` | Paginated inventory list |
| `GET` | `/api/inventory/:sku` | Single inventory item |
| `POST` | `/api/inventory` | Create inventory item |
| `PATCH` | `/api/inventory/:sku` | Update stock / price / details |
| `GET` | `/api/orders` | Paginated orders list |
| `GET` | `/api/orders/:id` | Single order |
| `PATCH` | `/api/orders/:id/status` | Update order status |
| `GET` | `/api/customers` | Paginated customer list |
| `GET` | `/api/store/catalog` | Public catalog (filterable) |
| `GET` | `/api/store/catalog/:slug` | Single product detail |
| `POST` | `/api/store/cart/checkout` | Submit cart / create order |
| `POST` | `/api/store/contact` | Contact form submission |
| `POST` | `/api/auth/login` | Staff login |
| `POST` | `/api/auth/logout` | Staff logout |
| `GET` | `/api/auth/me` | Current session |
