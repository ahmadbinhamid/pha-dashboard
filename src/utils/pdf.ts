// Client-side PDF export — same role csv.ts's downloadCsv played (the
// Reports page has no backend report-generation feature, so this turns data
// already loaded on the page into a real downloaded file), just producing an
// actual PDF report instead of a raw CSV. Same (filename, rows) shape as
// downloadCsv so every call site swaps over with no other changes.

import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";

// "avgOrderValue" -> "Avg Order Value", "items_sold" -> "Items Sold" — same
// column keys the CSV export already used as headers verbatim; this just
// makes them readable in a printed report instead of showing raw camelCase.
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
  // Landscape once there are enough columns that portrait would squeeze
  // them unreadably narrow — matches how wide the turnover export's
  // per-category columns can get.
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
