# Prestige Parts Group — Platform (Storefront + ERP UI)

This repo includes:

1. **Public customer storefront** (FCPEuro-style discovery, filters, PDP) — white-label ready  
2. **Internal ERP / operations UI** (dashboard, inventory, orders, POS, settings)

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000` — **homepage is the public store**. Staff ERP: `/login` → `/dashboard`.

## Routes (high level)

| Area | Paths |
|------|--------|
| **Store** | `/` (home), `/parts` (catalog + filters), `/parts/[slug]` (PDP), `/search`, `/brands`, `/about`, `/contact`, `/cart`, `/account` |
| **ERP** | `/login`, `/dashboard`, `/inventory`, `/orders`, `/orders/new`, `/products/[id]` (internal SKU screen), `/settings`, … |

**Why `/parts` not `/products`?** The ERP already uses `/products/[id]` for internal product records. Next.js cannot have two different dynamic param names at the same URL level, so the **public catalogue** lives under `/parts` and `/parts/[slug]`. You can add a marketing redirect later (e.g. `/products` → `/parts`) if you need that URL.

## Tech

- Next.js (App Router), React, TypeScript, Tailwind CSS  
- **Framer Motion** (store motion)  
- **shadcn-style UI** for the store: `class-variance-authority`, `@radix-ui/react-slot`, `tailwind-merge` — components live under `src/components/store/ui/` to stay separate from ERP widgets  
- Mock catalogue APIs: `src/lib/store/api/catalog-mock.ts` (swap for real `/api/...` later)  
- **Tenant / branding**: `src/lib/store/get-tenant.ts` — set `NEXT_PUBLIC_STORE_TENANT_SLUG` for a second demo tenant; future: subdomain + DB  

## SEO

Set `NEXT_PUBLIC_SITE_URL` for canonical / OG base (defaults to `http://localhost:3000` in `app/layout.tsx`).
