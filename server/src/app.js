// app.js

const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yaml");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const routes = require("./routes");
const domainService = require("./services/domain.service");

// The API process needs adapters registered for endListing on delete.
require("./services/marketplace/registerAdapters").registerAdapters();
const { requestLogger, errorLogger } = require("./middlewares/logging");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");
const requestId = require("./middlewares/requestId");
const uploadHeaders = require("./middlewares/uploadHeaders");

const app = express();

// Trust private-network hops, not a hop count; client XFF can't spoof req.ip.
app.set("trust proxy", "loopback, uniquelocal"); // NOTE: Cloudflare/public proxies need their ranges added.

// Core middlewares
app.use(requestId);
app.use(helmet());
const allowedOrigins = config.cors.allowedOrigins;
// Per-tenant payment hosts can't be listed; allow any payment subdomain.
const paymentDomain = config.payment.linkDomain;

async function checkOrigin(origin, cb) {
  // Allow requests with no origin (curl, mobile apps, server-to-server)
  if (!origin) return cb(null, true);
  if (allowedOrigins.includes(origin)) return cb(null, true);
  if (paymentDomain) {
    try {
      const { hostname, protocol } = new URL(origin);
      if (protocol === "https:" && (hostname === paymentDomain || hostname.endsWith(`.${paymentDomain}`))) {
        return cb(null, true);
      }
    } catch {
      // Malformed Origin header: fall through to rejection.
    }
  }
  // A tenant's own custom domain, only once it passed TXT verification.
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol === "https:") {
      const activeHostnames = await domainService.getActiveHostnames();
      if (activeHostnames.includes(hostname)) return cb(null, true);
    }
  } catch {
    // Bad Origin or failed DB lookup: fall through to rejection, never open.
  }
  cb(new Error(`CORS: origin ${origin} not allowed`));
}

app.use(
  cors({
    origin:
      allowedOrigins.length > 0
        ? // Sync wrapper: cors never awaits, so an async fn would leak rejections.
          (origin, cb) => {
            checkOrigin(origin, cb).catch((err) => cb(err));
          }
        : true, // dev fallback: allow all
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Tenant-Slug"],
    credentials: true,
  })
);
app.use(express.json({
  limit: "1mb",
  verify: (_req, _res, buf) => { _req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

app.use("/uploads", uploadHeaders, express.static(config.uploads.dir));

// Auto logging (request/response)
app.use(requestLogger);

// Routes
app.use("/api/v1", routes);

const spec = YAML.parse(
  fs.readFileSync(path.join(__dirname, "../docs/openapi.yaml"), "utf8")
);

app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));
// optional: raw JSON
app.get("/docs.json", (_req, res) => res.json(spec));

// 404 & error handling
app.use(notFound);
app.use(errorLogger); // logs stack traces with winston
app.use(errorHandler);

module.exports = app;
