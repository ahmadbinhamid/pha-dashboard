// controllers/seo.controller.js

const articleService = require("../services/seo/article.service");
const pageService = require("../services/seo/page.service");
const redirectService = require("../services/seo/redirect.service");
const catalogSeo = require("../services/seo/catalog-seo.service");
const seoSettings = require("../services/seo/seo-settings.service");
const membershipService = require("../services/membership.service");
const { success, created, systemfailure } = require("../utils/http/response");
const { httpError } = require("../utils/http/httpError");

const PUBLISH_PERMISSION = "seo.publish";

/** Wraps a service call in the usual success/failure envelope. */
const handle = (run, { message = "OK", status = "ok" } = {}) => async (req, res) => {
  try {
    const data = await run(req);
    return status === "created" ? created(res, data, message) : success(res, data, message);
  } catch (err) {
    return systemfailure(res, err);
  }
};

const paged = (req) => ({ skip: req.pagination.skip, limit: req.pagination.limit });
const pageEnvelope = (req, { items, total }) => ({
  items,
  total,
  page: req.pagination.page,
  limit: req.pagination.limit,
  totalPages: Math.max(Math.ceil(total / req.pagination.limit), 1),
});

/** Going live, going dark or re-dating needs seo.publish, not just update. */
function assertCanPublish(req, body, current = {}) {
  const statusChange = body.status !== undefined && body.status !== (current.status ?? "draft");
  const time = (d) => (d ? new Date(d).getTime() : null);
  const dateChange = body.published_at !== undefined && time(body.published_at) !== time(current.published_at);
  if (!statusChange && !dateChange) return;
  if (!membershipService.requestPermissions(req).includes(PUBLISH_PERMISSION)) {
    throw httpError("You need permission to publish. Save it as a draft for someone who can.", 403);
  }
}

// ── articles ──

exports.listArticles = handle(async (req) =>
  pageEnvelope(req, await articleService.listArticles(req.tenantId, { ...paged(req), ...req.query })),
);
exports.listArticleTags = handle((req) => articleService.listTags(req.tenantId));
exports.getArticle = handle((req) => articleService.getArticle(req.params.id, req.tenantId));
exports.createArticle = handle(
  (req) => {
    assertCanPublish(req, req.body);
    return articleService.createArticle(req.tenantId, req.body);
  },
  { message: "Article created", status: "created" },
);
exports.updateArticle = handle(
  async (req) => {
    assertCanPublish(req, req.body, await articleService.getArticle(req.params.id, req.tenantId));
    return articleService.updateArticle(req.params.id, req.tenantId, req.body);
  },
  { message: "Article saved" },
);
exports.deleteArticle = handle((req) => articleService.deleteArticle(req.params.id, req.tenantId), { message: "Article deleted" });

// ── pages ──

exports.listPages = handle((req) => pageService.listPages(req.tenantId, req.query));
exports.getPage = handle((req) => pageService.getPage(req.params.id, req.tenantId));
exports.createPage = handle(
  (req) => {
    assertCanPublish(req, req.body);
    return pageService.createPage(req.tenantId, req.body);
  },
  { message: "Page created", status: "created" },
);
exports.updatePage = handle(
  async (req) => {
    assertCanPublish(req, req.body, await pageService.getPage(req.params.id, req.tenantId));
    return pageService.updatePage(req.params.id, req.tenantId, req.body);
  },
  { message: "Page saved" },
);
exports.deletePage = handle((req) => pageService.deletePage(req.params.id, req.tenantId), { message: "Page deleted" });

// ── redirects ──

exports.listRedirects = handle(async (req) =>
  pageEnvelope(req, await redirectService.listRedirects(req.tenantId, { ...paged(req), search: req.query.search })),
);
exports.createRedirect = handle((req) => redirectService.createRedirect(req.tenantId, req.body), {
  message: "Redirect added",
  status: "created",
});
exports.updateRedirect = handle((req) => redirectService.updateRedirect(req.params.id, req.tenantId, req.body), {
  message: "Redirect saved",
});
exports.deleteRedirect = handle((req) => redirectService.deleteRedirect(req.params.id, req.tenantId), { message: "Redirect deleted" });

// ── catalogue SEO ──

const catalogFilters = (req) => ({ ...paged(req), search: req.query.search, missing: req.query.missing });

exports.listProductSeo = handle(async (req) => pageEnvelope(req, await catalogSeo.listProductSeo(req.tenantId, catalogFilters(req))));
exports.updateProductSeo = handle((req) => catalogSeo.updateProductSeo(req.params.id, req.tenantId, req.body), {
  message: "Product SEO saved",
});
exports.listCategorySeo = handle(async (req) => pageEnvelope(req, await catalogSeo.listCategorySeo(req.tenantId, catalogFilters(req))));
exports.updateCategorySeo = handle((req) => catalogSeo.updateCategorySeo(req.params.id, req.tenantId, req.body), {
  message: "Category SEO saved",
});

// ── settings ──

exports.getOverview = handle((req) => seoSettings.getSeoOverview(req.tenantId));
exports.getSettings = handle((req) => seoSettings.getSeoSettings(req.tenantId));
exports.updateSettings = handle((req) => seoSettings.updateSeoSettings(req.tenantId, req.body), { message: "SEO settings saved" });

// ── storefront (guest) ──

exports.publicSettings = handle((req) => seoSettings.getPublicSeo(req.tenantId));
exports.publicArticles = handle((req) =>
  articleService.listPublishedArticles(req.tenantId, { page: req.query.page ?? 1, tag: req.query.tag }),
);
exports.publicArticleTags = handle((req) => articleService.listTags(req.tenantId, { publishedOnly: true }));
exports.publicArticle = handle((req) => articleService.getPublishedArticle(req.tenantId, req.params.slug));
exports.publicPage = handle((req) => pageService.getPublishedPage(req.tenantId, req.params.slug));
exports.publicRedirect = handle((req) => redirectService.resolveRedirect(req.tenantId, req.query.path));
exports.publicSitemap = handle((req) => seoSettings.getSitemapEntries(req.tenantId));

// Exported for tests; routes go through the handlers above.
exports.assertCanPublish = assertCanPublish;
