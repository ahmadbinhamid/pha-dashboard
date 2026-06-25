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

// Register marketplace adapters — needed by the API process for endListing on delete
require("./services/marketplace/registry").register(
  require("./services/marketplace/adapters/ebay.adapter"),
);
const { requestLogger, errorLogger } = require("./middlewares/logging");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");
const requestId = require("./middlewares/requestId");

const app = express();

// Core middlewares
app.use(requestId);
app.use(helmet());
const allowedOrigins = config.cors.allowedOrigins;
app.use(
  cors({
    origin:
      allowedOrigins.length > 0
        ? (origin, cb) => {
            // Allow requests with no origin (curl, mobile apps, server-to-server)
            if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
            cb(new Error(`CORS: origin ${origin} not allowed`));
          }
        : true, // dev fallback: allow all
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json({
  limit: "1mb",
  verify: (_req, _res, buf) => { _req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Serve uploaded files
// Override helmet's same-origin CORP so the FE (different port) can load images
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
