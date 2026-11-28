// services/campaign/contact-sheet.service.js
// Reads contact spreadsheets (xlsx/csv) and streams contact exports as xlsx.

const { Readable } = require("stream");
const ExcelJS = require("exceljs");
const { httpError } = require("../../utils/http/httpError");
const { IMPORT_HEADER_ALIASES, IMPORT_MAX_ROWS, EXPORT_MAX_ROWS } = require("../../constants/campaign.constants");

const EMAIL_PATTERN = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;
const MAX_FIELD_LENGTH = 120;

const EXPORT_COLUMNS = [
  { header: "Email", key: "email", width: 34 },
  { header: "First name", key: "first_name", width: 18 },
  { header: "Last name", key: "last_name", width: 18 },
  { header: "Status", key: "status", width: 14 },
  { header: "Source", key: "source", width: 14 },
  { header: "Lists", key: "lists", width: 30 },
  { header: "Subscribed at", key: "subscribed_at", width: 20 },
  { header: "Unsubscribed at", key: "unsubscribed_at", width: 20 },
];

/** Plain text from any ExcelJS cell value: rich text, links, formulas. */
function cellText(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return String(value).trim();
  if (Array.isArray(value.richText)) return value.richText.map((r) => r.text).join("").trim();
  if (value.text != null) return cellText(value.text);
  if (value.result != null) return cellText(value.result);
  if (value.hyperlink) return String(value.hyperlink).replace(/^mailto:/i, "").trim();
  return "";
}

async function loadWorksheet(buffer, isCsv) {
  const workbook = new ExcelJS.Workbook();
  try {
    if (isCsv) await workbook.csv.read(Readable.from(buffer));
    else await workbook.xlsx.load(buffer);
  } catch {
    throw httpError("We couldn't read that file. Upload an .xlsx or .csv spreadsheet.", 400);
  }
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.actualRowCount === 0) throw httpError("The spreadsheet is empty", 400);
  return sheet;
}

/** Column index per field from the header row; null when it has no header. */
function mapHeaderColumns(headerRow) {
  const columns = {};
  headerRow.eachCell((cell, col) => {
    const field = IMPORT_HEADER_ALIASES[cellText(cell.value).toLowerCase()];
    if (field && !columns[field]) columns[field] = col;
  });
  return columns.email ? columns : null;
}

function readRow(row, columns) {
  const get = (field) => (columns[field] ? cellText(row.getCell(columns[field]).value).slice(0, MAX_FIELD_LENGTH) : "");
  const email = get("email").toLowerCase();
  let firstName = get("first_name");
  let lastName = get("last_name");
  const fullName = get("name");
  if (fullName && !firstName && !lastName) {
    const [first, ...rest] = fullName.split(/\s+/);
    firstName = first;
    lastName = rest.join(" ");
  }
  const lists = get("lists").split(/[,;|]/).map((l) => l.trim()).filter(Boolean);
  return { email, first_name: firstName || null, last_name: lastName || null, lists };
}

/** Valid, de-duplicated rows plus counts of what was dropped and why. */
async function parseContactSheet(file) {
  const isCsv = /\.csv$/i.test(file.originalname) || file.mimetype === "text/csv";
  const sheet = await loadWorksheet(file.buffer, isCsv);
  const headerColumns = mapHeaderColumns(sheet.getRow(1));
  // No recognised header: treat column A as emails, starting at row 1.
  const columns = headerColumns ?? { email: 1 };
  const firstDataRow = headerColumns ? 2 : 1;
  if (sheet.actualRowCount - firstDataRow + 1 > IMPORT_MAX_ROWS) {
    throw httpError(`A file can hold at most ${IMPORT_MAX_ROWS.toLocaleString()} contacts`, 400);
  }

  const byEmail = new Map();
  let invalid = 0;
  let duplicates = 0;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < firstDataRow) return;
    const parsed = readRow(row, columns);
    if (!parsed.email && !parsed.first_name && !parsed.last_name) return;
    if (!EMAIL_PATTERN.test(parsed.email)) invalid += 1;
    else if (byEmail.has(parsed.email)) duplicates += 1;
    else byEmail.set(parsed.email, parsed);
  });
  if (!byEmail.size) throw httpError("No valid email addresses found. Add an \"Email\" column header.", 422);
  return { rows: [...byEmail.values()], invalid, duplicates };
}

const formatDate = (d) => (d ? new Date(d).toISOString().slice(0, 16).replace("T", " ") : "");

/** Streams contacts from a cursor into an xlsx written straight to `stream`. */
async function writeContactsWorkbook(cursor, stream) {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useStyles: true });
  const sheet = workbook.addWorksheet("Contacts");
  sheet.columns = EXPORT_COLUMNS;
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).commit();
  let count = 0;
  for await (const c of cursor) {
    if (count >= EXPORT_MAX_ROWS) break;
    sheet
      .addRow({
        ...c,
        lists: (c.lists ?? []).join(", "),
        subscribed_at: formatDate(c.subscribed_at),
        unsubscribed_at: formatDate(c.unsubscribed_at),
      })
      .commit();
    count += 1;
  }
  sheet.commit();
  await workbook.commit();
  return count;
}

module.exports = { parseContactSheet, writeContactsWorkbook };
