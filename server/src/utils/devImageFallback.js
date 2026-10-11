// utils/devImageFallback.js
// One test-only placeholder, for every channel, for images it can't fetch.

const config = require("../config");
const { logger } = require("../loaders/logging");
const { isAbsoluteHttpsUrl } = require("./url");
const { DEV_FALLBACK_IMAGE } = require("../constants/channel.constants");

// NOTE: a .env URL is used as-is (not fetched); .env.example states its rules.
function devFallbackImage() {
  const custom = config.channels.devFallbackImageUrl;
  if (!custom) return DEV_FALLBACK_IMAGE;
  if (isAbsoluteHttpsUrl(custom)) return { url: custom, width: null, height: null };
  logger.error(`[devImageFallback] CHANNEL_DEV_FALLBACK_IMAGE_URL is not public HTTPS ("${custom}"); not used`);
  return null;
}

// NOTE: primary image only; extras just drop. A missing image stays an error.
function devFallbackImageFor(url, { channel, sku }) {
  if (!url || isAbsoluteHttpsUrl(url) || !config.channels.devImageFallback) return null;
  if (config.env === "production") {
    logger.error(`[${channel}] ${sku}: CHANNEL_DEV_IMAGE_FALLBACK is ignored in production; image "${url}" rejected`);
    return null;
  }
  const fallback = devFallbackImage();
  if (fallback) logger.warn(`[${channel}] ${sku}: primary image "${url}" is not public HTTPS; using dev fallback image (dev only)`);
  return fallback;
}

module.exports = { devFallbackImage, devFallbackImageFor };
