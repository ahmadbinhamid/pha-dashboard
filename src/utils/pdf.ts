// Client-side PDF export, same role as csv.ts's downloadCsv (no backend report-generation feature, so this turns page-loaded data into a real file). Same (filename, rows) shape so every call site swaps over unchanged.

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

// "avgOrderValue" -> "Avg Order Value": same column keys the CSV export used verbatim, made readable instead of showing raw camelCase.
function humanizeHeader(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function downloadPdf(filename: string, rows: Record<string, unknown>[], options: { title?: string } = {}) {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  // Landscape once enough columns exist that portrait would squeeze them unreadably narrow, matching how wide the turnover export's per-category columns get.
  const doc = new jsPDF({ orientation: headers.length > 6 ? "landscape" : "portrait", unit: "pt" });

  const title = options.title ?? humanizeHeader(filename.replace(/\.pdf$/i, ""));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 40, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString("en-AU")}`, 40, 56);
  doc.setTextColor(0);

  if (rows.length === 0) {
    doc.setFontSize(11);
    doc.text("No data for the selected range.", 40, 90);
  } else {
    autoTable(doc, {
      startY: 70,
      head: [headers.map(humanizeHeader)],
      body: rows.map((row) => headers.map((h) => cellText(row[h]))),
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [24, 24, 27], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 40, right: 40 },
    });
  }

  doc.save(filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`);
}
