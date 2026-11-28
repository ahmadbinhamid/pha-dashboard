/** "%s | Store" with the page title filled in, as the storefront renders it. */
export function applyTitleTemplate(template: string | undefined, title: string) {
  if (!template || !template.includes("%s")) return title;
  return template.replace("%s", title);
}

export function stripHtml(html: string) {
  return html
    .replace(/<\/?(p|div|h[1-6]|li|br)\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Text Google would likely show, cut where it truncates. */
export function truncate(text: string, max: number) {
  return text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

/** Same rules as the server's slug helper, for a live URL preview. */
export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}
