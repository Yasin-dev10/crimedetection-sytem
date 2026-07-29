const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const History = require("../model/History");
const { cleanExtractedText } = require("../utils/pageTextCleaner");

const DATASET_DIR = path.join(__dirname, "..", "..", "model");
const DATASET_XLSX = path.join(DATASET_DIR, "collected_dataset.xlsx");
const DATASET_CSV = path.join(DATASET_DIR, "collected_dataset.csv");

const COLUMNS = [
  { header: "url", key: "url", width: 40 },
  { header: "text", key: "text", width: 80 },
  { header: "category", key: "category", width: 20 },
  { header: "sourceType", key: "sourceType", width: 14 },
  { header: "confidence", key: "confidence", width: 12 },
  { header: "matchedKeyword", key: "matchedKeyword", width: 22 },
  { header: "investigationStatus", key: "investigationStatus", width: 20 },
  { header: "createdAt", key: "createdAt", width: 24 },
  { header: "historyId", key: "historyId", width: 26 },
];

function normalizeCategory(prediction, isCrime) {
  if (isCrime === true) return "crime-related";
  if (isCrime === false) return "not crime-related";

  const p = String(prediction || "")
    .toLowerCase()
    .replace(/[_]+/g, " ")
    .trim();

  if (/not[\s-]*crime/.test(p) || p === "safe") return "not crime-related";
  if (/crime/.test(p)) return "crime-related";
  return "not crime-related";
}

function toDatasetRow(doc) {
  const sourceType = doc.sourceType || doc.type || "text";
  const isUrlLike =
    ["url", "website", "facebook"].includes(sourceType) || doc.type === "url";

  let url = doc.url || "";
  if (!url && isUrlLike && /^https?:\/\//i.test(String(doc.content || ""))) {
    url = doc.content;
  }

  let text = String(doc.extractedText || "").trim();
  if (!text) {
    const content = String(doc.content || "").trim();
    if (isUrlLike && url && content === url) {
      text = "";
    } else if (sourceType === "file" && !doc.extractedText) {
      text = "";
    } else {
      text = content;
    }
  }

  // Clean at read/export time so historical database records benefit too.
  // A migration is deliberately unnecessary and the original evidence remains intact.
  text = cleanExtractedText(text, 50000);

  return {
    url: url || "",
    text,
    category: normalizeCategory(doc.prediction, doc.isCrime),
    sourceType,
    confidence: Number(doc.confidence) || 0,
    matchedKeyword: doc.matchedKeyword || "",
    investigationStatus: doc.investigationStatus || "pending",
    createdAt: doc.createdAt
      ? new Date(doc.createdAt).toISOString()
      : new Date().toISOString(),
    historyId: doc._id ? String(doc._id) : "",
  };
}

function ensureDatasetDir() {
  if (!fs.existsSync(DATASET_DIR)) {
    fs.mkdirSync(DATASET_DIR, { recursive: true });
  }
}

function escapeCsv(value) {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCsvLine(row) {
  return COLUMNS.map((col) => escapeCsv(row[col.key])).join(",");
}

async function appendCollectedCsv(row) {
  ensureDatasetDir();
  const header = COLUMNS.map((c) => c.header).join(",");
  const line = rowToCsvLine(row);

  if (!fs.existsSync(DATASET_CSV)) {
    fs.writeFileSync(DATASET_CSV, `${header}\n${line}\n`, "utf8");
    return;
  }

  fs.appendFileSync(DATASET_CSV, `${line}\n`, "utf8");
}

async function appendCollectedXlsx(row) {
  ensureDatasetDir();
  const workbook = new ExcelJS.Workbook();

  if (fs.existsSync(DATASET_XLSX)) {
    await workbook.xlsx.readFile(DATASET_XLSX);
  }

  let sheet = workbook.getWorksheet("Dataset");
  if (!sheet) {
    sheet = workbook.addWorksheet("Dataset");
    sheet.columns = COLUMNS;
    sheet.getRow(1).font = { bold: true };
  } else if (!sheet.columns || sheet.columns.length === 0) {
    sheet.columns = COLUMNS;
  }

  sheet.addRow(row);
  await workbook.xlsx.writeFile(DATASET_XLSX);
}

/**
 * Persist one analysis record into local CSV + Excel for dataset study.
 * Never throws — analysis must not fail because of export I/O.
 */
async function appendIncomingDataset(historyDoc) {
  if (!historyDoc) return;

  try {
    const row = toDatasetRow(
      typeof historyDoc.toObject === "function"
        ? historyDoc.toObject()
        : historyDoc
    );

    await appendCollectedCsv(row);
    await appendCollectedXlsx(row);
  } catch (error) {
    console.error("DATASET STORE APPEND ERROR:", error.message);
  }
}

function buildHistoryFilter({ source = "all", userId = null, mineOnly = false } = {}) {
  const filter = {};

  if (mineOnly && userId) {
    filter.user = userId;
  }

  if (source === "facebook") {
    filter.sourceType = "facebook";
  } else if (source === "analysis") {
    filter.sourceType = { $nin: ["facebook", "website"] };
  } else if (source === "website") {
    filter.sourceType = "website";
  }

  return filter;
}

async function buildDatasetWorkbook(options = {}) {
  const filter = buildHistoryFilter(options);
  const records = await History.find(filter).sort({ createdAt: -1 }).lean();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BAREAI";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Dataset");
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  records.forEach((doc) => {
    sheet.addRow(toDatasetRow(doc));
  });

  // Training-ready sheet matching model/dataset.csv.csv columns only
  const training = workbook.addWorksheet("TrainingFormat");
  training.columns = [
    { header: "url", key: "url", width: 40 },
    { header: "text", key: "text", width: 80 },
    { header: "category", key: "category", width: 20 },
  ];
  training.getRow(1).font = { bold: true };
  records.forEach((doc) => {
    const row = toDatasetRow(doc);
    training.addRow({
      url: row.url,
      text: row.text,
      category: row.category,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, count: records.length };
}

async function buildDatasetCsv(options = {}) {
  const filter = buildHistoryFilter(options);
  const records = await History.find(filter).sort({ createdAt: -1 }).lean();
  const header = COLUMNS.map((c) => c.header).join(",");
  const lines = records.map((doc) => rowToCsvLine(toDatasetRow(doc)));
  return {
    csv: `\uFEFF${header}\n${lines.join("\n")}\n`,
    count: records.length,
  };
}

module.exports = {
  appendIncomingDataset,
  buildDatasetWorkbook,
  buildDatasetCsv,
  toDatasetRow,
  normalizeCategory,
  DATASET_XLSX,
  DATASET_CSV,
};
