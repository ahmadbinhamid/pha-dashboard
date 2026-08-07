# Running the test suite

`npm test` runs `node --test src/**/*.test.js` — Node's built-in test runner, no extra framework installed.

**Requires a live local MongoDB** (`MONGO_URI` in `.env`, default `mongodb://127.0.0.1:27017/...`). These are not unit tests against mocks of the database — they create/read/assert against real documents in whatever database `MONGO_URI` points at (each test uses a randomized tenant/SKU suffix so runs don't collide with real data or each other). External services (eBay's API, Redis/Bull, Stripe) are mocked via `node:test`'s built-in `mock.method`/`t.mock.method` — see the comment at the top of each test file for exactly what it mocks and why.

If Mongo isn't reachable, tests will hang or fail with a connection error rather than skip gracefully — start Mongo first.

To run a single file:

```
node --test src/services/ebay/ebay.inventory-sync.service.test.js
```

To run everything explicitly (`src/**/*.test.js` doesn't recursively glob in every shell — e.g. plain `zsh` without `setopt globstar`):

```
node --test $(find src -name "*.test.js")
```
