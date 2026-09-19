// Client-side CSV export — used by the Reports page's export buttons/panel
// to turn data already loaded on the page into a real downloaded file
// (no backend report-generation feature exists for this yet).

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  // A nested object/array stringifies to "[object Object]", which silently
  // ships a useless column (hit by the turnover export's per-category rates
  // — those are flattened into real columns at the call site now). JSON is
  // the honest fallback for anything still shaped that way.
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h])).join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
