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

// Register marketplace adapters, needed by the API process for endListing on delete.
require("./services/marketplace/registerAdapters").registerAdapters();
const { requestLogger, errorLogger } = require("./middlewares/logging");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");
const requestId = require("./middlewares/requestId");

const app = express();

// Trust exactly one hop (nginx), not `true` (every hop), which would let clients spoof
// req.ip and bypass IP-keyed rate limiting.
app.set("trust proxy", 1);

// Core middlewares
app.use(requestId);
app.use(helmet());
const allowedOrigins = config.cors.allowedOrigins;
// Every tenant gets its own payment host, so a fixed allowedOrigins list can't enumerate
// them all — accept any subdomain of the configured payment domain too.
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
      // malformed Origin header — fall through to rejection.
    }
  }
  // A tenant's own DNS-verified custom domain; only accepts hostnames that passed TXT verification.
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol === "https:") {
      const activeHostnames = await domainService.getActiveHostnames();
      if (activeHostnames.includes(hostname)) return cb(null, true);
    }
  } catch {
    // malformed Origin header, or the DB lookup failed — fall through to rejection, never fail open.
  }
  cb(new Error(`CORS: origin ${origin} not allowed`));
}

app.use(
  cors({
    origin:
      allowedOrigins.length > 0
        ? // Not async itself — the `cors` package never awaits the return value, only reacts to
          // cb(). An async origin fn would turn a future uncaught throw into an unhandled rejection.
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

// Serve uploaded files; override helmet's same-origin CORP so the FE (different port) can load images.
app.use("/uploads", (_req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(config.uploads.dir));

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
