// routes/seo.routes.js
// SEO & content: staff management plus the storefront's public reads.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const { resolveGuestTenant } = require("../middlewares/tenant");
const pagination = require("../middlewares/pagination");
const validate = require("../middlewares/validate");
const v = require("../validators/seo.validation");
const ctrl = require("../controllers/seo.controller");

// Guest: the storefront names its tenant via X-Tenant-Slug.
const guest = resolveGuestTenant();
router.get("/public/settings", guest, asyncHandler(ctrl.publicSettings));
router.get("/public/articles", guest, validate(v.publicArticles), asyncHandler(ctrl.publicArticles));
router.get("/public/articles/tags", guest, asyncHandler(ctrl.publicArticleTags));
router.get("/public/articles/:slug", guest, validate(v.publicSlug), asyncHandler(ctrl.publicArticle));
router.get("/public/pages/:slug", guest, validate(v.publicSlug), asyncHandler(ctrl.publicPage));
router.get("/public/redirect", guest, validate(v.publicRedirect), asyncHandler(ctrl.publicRedirect));
router.get("/public/sitemap", guest, asyncHandler(ctrl.publicSitemap));

const canView = requirePermission("seo.view");
const canCreate = requirePermission("seo.create");
const canUpdate = requirePermission("seo.update");
const canDelete = requirePermission("seo.delete");

router.get("/overview", auth(), canView, asyncHandler(ctrl.getOverview));
router.get("/settings", auth(), canView, asyncHandler(ctrl.getSettings));
router.put("/settings", auth(), canUpdate, validate(v.updateSettings), asyncHandler(ctrl.updateSettings));

router.get("/articles", auth(), canView, validate(v.listArticles), pagination(), asyncHandler(ctrl.listArticles));
router.get("/articles/tags", auth(), canView, asyncHandler(ctrl.listArticleTags));
router.post("/articles", auth(), canCreate, validate(v.createArticle), asyncHandler(ctrl.createArticle));
router.get("/articles/:id", auth(), canView, validate(v.byIdParam), asyncHandler(ctrl.getArticle));
router.patch("/articles/:id", auth(), canUpdate, validate(v.updateArticle), asyncHandler(ctrl.updateArticle));
router.delete("/articles/:id", auth(), canDelete, validate(v.byIdParam), asyncHandler(ctrl.deleteArticle));

router.get("/pages", auth(), canView, validate(v.listPages), asyncHandler(ctrl.listPages));
router.post("/pages", auth(), canCreate, validate(v.createPage), asyncHandler(ctrl.createPage));
router.get("/pages/:id", auth(), canView, validate(v.byIdParam), asyncHandler(ctrl.getPage));
router.patch("/pages/:id", auth(), canUpdate, validate(v.updatePage), asyncHandler(ctrl.updatePage));
router.delete("/pages/:id", auth(), canDelete, validate(v.byIdParam), asyncHandler(ctrl.deletePage));

router.get("/redirects", auth(), canView, validate(v.listRedirects), pagination({ defaultLimit: 25 }), asyncHandler(ctrl.listRedirects));
router.post("/redirects", auth(), canCreate, validate(v.createRedirect), asyncHandler(ctrl.createRedirect));
router.patch("/redirects/:id", auth(), canUpdate, validate(v.updateRedirect), asyncHandler(ctrl.updateRedirect));
router.delete("/redirects/:id", auth(), canDelete, validate(v.byIdParam), asyncHandler(ctrl.deleteRedirect));

const catalogList = [auth(), canView, validate(v.listCatalogSeo), pagination({ defaultLimit: 25 })];
router.get("/catalog/products", ...catalogList, asyncHandler(ctrl.listProductSeo));
router.patch("/catalog/products/:id", auth(), canUpdate, validate(v.updateCatalogSeo), asyncHandler(ctrl.updateProductSeo));
router.get("/catalog/categories", ...catalogList, asyncHandler(ctrl.listCategorySeo));
router.patch("/catalog/categories/:id", auth(), canUpdate, validate(v.updateCatalogSeo), asyncHandler(ctrl.updateCategorySeo));

module.exports = router;
