// services/campaign/email-design.service.js
// Renders builder JSON into table-based, inline-styled email HTML.

const { getCompanyProfile } = require("../tenant-settings.service");
const { getDefaultStorefrontHost } = require("../domain.service");
const config = require("../../config");
const { sanitizeEmailHtml, escapeHtml } = require("../../utils/emailHtml");
const { DESIGN_BLOCK, DESIGN_FONTS } = require("../../constants/campaign.constants");

const DEFAULT_LAYOUT = Object.freeze({
  background_color: "#f4f4f5",
  content_background: "#ffffff",
  content_width: 600,
  font_family: DESIGN_FONTS.arial,
  text_color: "#333333",
  link_color: "#f97316",
});

const SIDE_PADDING = 24;
const SOCIAL_LABELS = Object.freeze({
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  website: "Website",
});

const attr = (value) => escapeHtml(value ?? "");

/** Root-relative paths get the store's host; anything unsafe becomes "#". */
function resolveUrl(url, ctx) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (value.startsWith("/")) return `${ctx.storefrontUrl.replace(/\/$/, "")}${value}`;
  return /^(https?:|mailto:|tel:)/i.test(value) ? value : "#";
}

/** Wrapper colours and width for campaign.hbs, from design settings. */
function designLayout(design) {
  const s = design?.settings ?? {};
  return {
    background_color: s.background_color || DEFAULT_LAYOUT.background_color,
    content_background: s.content_background || DEFAULT_LAYOUT.content_background,
    content_width: s.content_width || DEFAULT_LAYOUT.content_width,
    font_family: DESIGN_FONTS[s.font_family] || DEFAULT_LAYOUT.font_family,
    text_color: s.text_color || DEFAULT_LAYOUT.text_color,
    link_color: s.link_color || DEFAULT_LAYOUT.link_color,
  };
}

function alignTable(align, inner) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${attr(align || "center")}"><tr><td>${inner}</td></tr></table>`;
}

function renderHeading(p) {
  const level = [1, 2, 3].includes(p.level) ? p.level : 2;
  const size = p.font_size || { 1: 30, 2: 24, 3: 19 }[level];
  const style = `margin:0;font-size:${size}px;line-height:1.25;font-weight:bold;color:${attr(p.color || "inherit")};text-align:${attr(p.align || "left")};`;
  return `<h${level} style="${style}">${escapeHtml(p.text)}</h${level}>`;
}

function renderText(p) {
  const style = `font-size:${p.font_size || 15}px;line-height:1.6;color:${attr(p.color || "inherit")};text-align:${attr(p.align || "left")};`;
  return `<div style="${style}">${sanitizeEmailHtml(p.html)}</div>`;
}

// Table-cell buttons survive Outlook, where padded <a> tags collapse.
function renderButton(p, ctx) {
  const radius = p.radius ?? 6;
  const linkStyle =
    `display:block;padding:13px 26px;color:${attr(p.text_color || "#ffffff")};` +
    `text-decoration:none;font-weight:bold;font-size:15px;border-radius:${radius}px;text-align:center;`;
  const cell = `<td style="background:${attr(p.bg_color || "#f97316")};border-radius:${radius}px;">` +
    `<a href="${attr(resolveUrl(p.url, ctx) || "#")}" target="_blank" style="${linkStyle}">${escapeHtml(p.label || "Shop now")}</a></td>`;
  const width = p.full_width ? ' width="100%"' : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="${attr(p.align || "center")}"${width}><tr>${cell}</tr></table>`;
}

function imageTag({ src, alt, widthPx, radius }) {
  const style = `display:block;width:100%;max-width:${widthPx}px;height:auto;border:0;border-radius:${radius || 0}px;`;
  return `<img src="${attr(src)}" alt="${attr(alt)}" width="${widthPx}" style="${style}" />`;
}

function renderImage(p, ctx, innerWidth) {
  if (!p.src) return "";
  const widthPx = Math.round((innerWidth * (p.width || 100)) / 100);
  const img = imageTag({ src: p.src, alt: p.alt, widthPx, radius: p.radius });
  const link = resolveUrl(p.link_url, ctx);
  return alignTable(p.align, link ? `<a href="${attr(link)}" target="_blank">${img}</a>` : img);
}

function renderLogo(p, ctx) {
  if (!ctx.logoUrl) return `<div style="font-size:22px;font-weight:bold;text-align:${attr(p.align || "center")};">${escapeHtml(ctx.storeName)}</div>`;
  const img = imageTag({ src: ctx.logoUrl, alt: ctx.storeName, widthPx: p.width || 140 });
  return alignTable(p.align, `<a href="${attr(ctx.storefrontUrl)}" target="_blank">${img}</a>`);
}

function renderDivider(p) {
  return `<div style="border-top:${p.thickness || 1}px solid ${attr(p.color || "#e4e4e7")};font-size:0;line-height:0;">&nbsp;</div>`;
}

function renderSpacer(p) {
  const h = p.height || 24;
  return `<div style="height:${h}px;line-height:${h}px;font-size:0;">&nbsp;</div>`;
}

function productCell(item, p, ctx, widthPct) {
  const url = attr(resolveUrl(item.url, ctx) || ctx.storefrontUrl);
  const image = item.image ? `<a href="${url}" target="_blank">${imageTag({ src: item.image, alt: item.title, widthPx: 260, radius: 6 })}</a>` : "";
  const price = p.show_price !== false && item.price_label ? `<div style="font-weight:bold;margin:4px 0 8px;">${escapeHtml(item.price_label)}</div>` : "";
  const button = p.button_label
    ? `<a href="${url}" target="_blank" style="color:${attr(p.accent_color || "#f97316")};font-weight:bold;text-decoration:none;">${escapeHtml(p.button_label)} &rarr;</a>`
    : "";
  return `<td class="col" width="${widthPct}%" valign="top" style="padding:8px;font-size:14px;">${image}` +
    `<div style="margin-top:8px;line-height:1.35;">${escapeHtml(item.title)}</div>${price}${button}</td>`;
}

function renderProducts(p, ctx) {
  const items = p.items ?? [];
  if (!items.length) return "";
  const perRow = [1, 2, 3].includes(p.columns) ? p.columns : 2;
  const widthPct = Math.floor(100 / perRow);
  const rows = [];
  for (let i = 0; i < items.length; i += perRow) {
    const cells = items.slice(i, i + perRow).map((item) => productCell(item, p, ctx, widthPct));
    while (cells.length < perRow) cells.push(`<td class="col" width="${widthPct}%"></td>`);
    rows.push(`<tr>${cells.join("")}</tr>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.join("")}</table>`;
}

function renderSocial(p) {
  const links = (p.links ?? []).filter((l) => /^https?:/i.test(l.url || ""));
  if (!links.length) return "";
  const style = `display:inline-block;margin:0 8px;color:${attr(p.color || "inherit")};font-size:13px;font-weight:bold;text-decoration:none;`;
  const anchors = links.map((l) => `<a href="${attr(l.url)}" target="_blank" style="${style}">${escapeHtml(SOCIAL_LABELS[l.network] || "Link")}</a>`);
  return `<div style="text-align:${attr(p.align || "center")};">${anchors.join("")}</div>`;
}

function renderColumns(p, ctx, innerWidth) {
  const cols = (p.columns ?? []).slice(0, 2);
  if (!cols.length) return "";
  const gap = p.gap ?? 16;
  const colWidth = Math.floor((innerWidth - gap) / cols.length);
  const cells = cols.map((col, i) => {
    const inner = (col.blocks ?? []).map((b) => renderLeaf(b, ctx, colWidth)).join("");
    const pad = i === 0 ? `padding-right:${gap / 2}px;` : `padding-left:${gap / 2}px;`;
    return `<td class="col" width="${Math.floor(100 / cols.length)}%" valign="top" style="${pad}">${inner}</td>`;
  });
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells.join("")}</tr></table>`;
}

const RENDERERS = Object.freeze({
  [DESIGN_BLOCK.HEADING]: renderHeading,
  [DESIGN_BLOCK.TEXT]: renderText,
  [DESIGN_BLOCK.BUTTON]: renderButton,
  [DESIGN_BLOCK.IMAGE]: renderImage,
  [DESIGN_BLOCK.LOGO]: renderLogo,
  [DESIGN_BLOCK.DIVIDER]: renderDivider,
  [DESIGN_BLOCK.SPACER]: renderSpacer,
  [DESIGN_BLOCK.PRODUCTS]: renderProducts,
  [DESIGN_BLOCK.SOCIAL]: renderSocial,
  [DESIGN_BLOCK.COLUMNS]: renderColumns,
});

/** A block inside a column: no row wrapper, just vertical spacing. */
function renderLeaf(block, ctx, width) {
  const render = RENDERERS[block.type];
  if (!render || block.type === DESIGN_BLOCK.COLUMNS) return "";
  const p = block.props ?? {};
  const pad = p.padding_y ?? 8;
  return `<div style="padding:${pad}px 0;">${render(p, ctx, width)}</div>`;
}

function renderRow(block, ctx, contentWidth) {
  const render = RENDERERS[block.type];
  if (!render) return "";
  const p = block.props ?? {};
  const pad = p.padding_y ?? 12;
  const bg = p.background ? `background:${attr(p.background)};` : "";
  const innerWidth = contentWidth - SIDE_PADDING * 2;
  return `<tr><td style="padding:${pad}px ${SIDE_PADDING}px;${bg}">${render(p, ctx, innerWidth)}</td></tr>`;
}

/** Content rows only; campaign.hbs adds the page wrapper and footer. */
function renderDesignHtml(design, ctx) {
  const { content_width } = designLayout(design);
  const rows = (design?.blocks ?? []).map((b) => renderRow(b, ctx, content_width)).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
}

/** Store name, logo and website the renderer links to, per tenant. */
async function designContext(tenantId) {
  const [profile, host] = await Promise.all([getCompanyProfile(tenantId), getDefaultStorefrontHost(tenantId)]);
  return {
    storeName: profile.company_name || config.emailBrand.appName,
    logoUrl: profile.logo_url || null,
    storefrontUrl: host ? `https://${host}` : config.emailBrand.storefrontUrl,
  };
}

async function renderDesignForTenant(tenantId, design) {
  return renderDesignHtml(design, await designContext(tenantId));
}

module.exports = { renderDesignForTenant, designLayout, DEFAULT_LAYOUT };
