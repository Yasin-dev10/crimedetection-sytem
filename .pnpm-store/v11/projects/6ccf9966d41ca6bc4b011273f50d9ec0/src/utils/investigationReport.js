import { jsPDF } from "jspdf";

const BRAND = "BAREAI";

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function formatCategory(category = "") {
  return String(category || "general")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDecision(status) {
  if (status === "crime_case") return "Crime Case — Confirmed";
  if (status === "not_crime") return "Not Crime — Dismissed";
  if (status === "resolved") return "Resolved";
  return String(status || "—")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCaseId(item) {
  if (!item?._id) return "N/A";
  const date = item.createdAt
    ? new Date(item.createdAt).toISOString().slice(0, 10)
    : "CASE";
  return `${date}-${String(item._id).slice(-3).toUpperCase()}`;
}

function buildSourceSummary(history = {}) {
  const parts = [];
  const source = history.sourceType || history.type;
  if (source) parts.push(String(source));
  if (history.pageName) parts.push(history.pageName);
  if (history.authorName) parts.push(`Author: ${history.authorName}`);
  const url =
    history.url ||
    (String(history.content || "").match(/https?:\/\/[^\s"'<>]+/i) || [])[0] ||
    null;
  if (url) parts.push(url);
  return parts.filter(Boolean).join(" · ") || "—";
}

/**
 * Build a normalized investigation report view model from a case + optional formal report.
 */
export function buildInvestigationReport(item, formalReport = null) {
  const history = item?.history || {};
  const startedAt =
    item?.investigationStartedAt || item?.assignedAt || item?.createdAt || null;
  const investigatorUser =
    formalReport?.investigator || item?.assignedOfficer || null;

  return {
    reportId: formalReport?._id || formalReport?.id || null,
    reportTitle: formalReport?.title || `Investigation Report — ${formatCaseId(item)}`,
    reportStatus: formalReport?.status || null,
    reportRecommendation: (formalReport?.recommendation || "").trim() || "—",
    reportUpdatedAtLabel: formatDateTime(formalReport?.updatedAt),
    reportCreatedAtLabel: formatDateTime(formalReport?.createdAt),
    caseId: formatCaseId(item),
    caseObjectId: item?._id || null,
    category: formatCategory(item?.category),
    status: item?.status || null,
    decision: formatDecision(item?.status),
    investigator: investigatorUser?.name
      ? `Det. ${investigatorUser.name}`
      : "Unassigned",
    investigatorEmail: investigatorUser?.email || null,
    badgeNumber: investigatorUser?.badgeNumber || null,
    station: investigatorUser?.station || null,
    resolvedBy: item?.resolvedBy?.name
      ? `Det. ${item.resolvedBy.name}`
      : item?.assignedOfficer?.name
      ? `Det. ${item.assignedOfficer.name}`
      : "—",
    investigationStartedAt: startedAt,
    investigationStartedAtLabel: formatDateTime(startedAt),
    resolvedAt: item?.resolvedAt || null,
    resolvedAtLabel: formatDateTime(item?.resolvedAt),
    createdAtLabel: formatDateTime(item?.createdAt),
    source: buildSourceSummary(history),
    sourceType: history.sourceType || history.type || null,
    url:
      history.url ||
      (String(history.content || "").match(/https?:\/\/[^\s"'<>]+/i) || [])[0] ||
      null,
    content: history.content || "No content available.",
    aiPrediction: history.isCrime
      ? "Criminal Intent Detected"
      : "No Criminal Intent",
    confidence: history.confidence ?? null,
    matchedKeyword: history.matchedKeyword || null,
    findings:
      (formalReport?.findings || item?.findings || "").trim() ||
      "No findings recorded.",
    notes: (item?.notes || []).map((note) => ({
      text: note.text,
      officer: note.officer?.name || "Officer",
      at: formatDateTime(note.createdAt),
    })),
    generatedAt: new Date(),
    generatedAtLabel: formatDateTime(new Date()),
  };
}

function downloadBlob(content, fileName, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function addWrappedText(doc, text, x, y, maxWidth, lineHeight = 5) {
  const lines = doc.splitTextToSize(String(text || "—"), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

/**
 * Export a single-case Investigation Report as PDF.
 */
export function exportInvestigationCasePDF(item, formalReport = null) {
  const report = buildInvestigationReport(item, formalReport);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const maxWidth = pageWidth - margin * 2;
  let y = 42;

  const ensureSpace = (needed = 20) => {
    if (y + needed < pageHeight - 16) return;
    doc.addPage();
    y = 20;
  };

  // Header
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, pageWidth, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(BRAND, margin, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(report.reportTitle || "Investigation Report", margin, 20);
  doc.setFontSize(8);
  doc.text(`${report.caseId}  |  ${report.generatedAtLabel}`, margin, 27);

  const section = (title) => {
    ensureSpace(16);
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.6);
    doc.rect(margin, y, maxWidth, 8, "FD");
    doc.setTextColor(30, 58, 138);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(title.toUpperCase(), margin + 3, y + 5.5);
    y += 12;
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
  };

  const field = (label, value) => {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(label, margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    y = addWrappedText(doc, value, margin, y, maxWidth, 4.5);
    y += 4;
  };

  section("Report Details");
  field("Title", report.reportTitle);
  if (report.reportStatus) field("Report Status", String(report.reportStatus).toUpperCase());
  field("Author", report.investigator);

  section("Case Summary");
  field("Case ID", report.caseId);
  field("Crime Category", report.category);
  field("Investigator", `${report.investigator}${report.badgeNumber ? ` · Badge ${report.badgeNumber}` : ""}`);
  field("Investigation Started", report.investigationStartedAtLabel);
  field("Resolved At", report.resolvedAtLabel);
  field("Resolved By", report.resolvedBy);
  field("Final Decision", report.decision);

  section("Case Source");
  field("Source", report.source);
  field("AI Prediction", `${report.aiPrediction}${report.confidence != null ? ` (${report.confidence}%)` : ""}`);
  if (report.matchedKeyword) field("Matched Keyword", report.matchedKeyword);
  field("Incident Content", report.content);

  section("Findings");
  field("What was discovered", report.findings);

  section("Recommendation");
  field("Recommendation", report.reportRecommendation);

  section("Investigation Notes");
  if (!report.notes.length) {
    field("Notes", "No notes recorded.");
  } else {
    report.notes.forEach((note, index) => {
      ensureSpace(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 58, 138);
      doc.setFontSize(8);
      doc.text(`Note ${index + 1} — ${note.officer} · ${note.at}`, margin, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      y = addWrappedText(doc, note.text, margin, y, maxWidth, 4.5);
      y += 5;
    });
  }

  section("Final Record");
  field("Decision", report.decision);
  field("Closure Time", report.resolvedAtLabel);
  field("Accountability", `${report.investigator} authored this investigation report.`);

  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 28, pageHeight - 8);
    doc.text("Confidential — BAREAI Investigation Report", margin, pageHeight - 8);
  }

  const fileSafe = String(report.caseId).replace(/[^a-z0-9_-]+/gi, "_");
  downloadBlob(
    doc.output("blob"),
    `investigation_report_${fileSafe}.pdf`,
    "application/pdf"
  );
}

/**
 * Open a print-friendly Investigation Report window.
 */
export function printInvestigationCase(item, formalReport = null) {
  const report = buildInvestigationReport(item, formalReport);
  const notesHtml = report.notes.length
    ? report.notes
        .map(
          (n) =>
            `<div class="note"><p>${escapeHtml(n.text)}</p><small>${escapeHtml(
              n.officer
            )} · ${escapeHtml(n.at)}</small></div>`
        )
        .join("")
    : "<p class='muted'>No notes recorded.</p>";

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(report.reportTitle)}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; color: #0f172a; margin: 32px; line-height: 1.45; }
    h1 { font-size: 22px; margin: 0 0 4px; color: #1e3a8a; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 4px; margin: 22px 0 10px; }
    .meta { color: #64748b; font-size: 12px; margin-bottom: 18px; }
    .row { margin-bottom: 10px; }
    .label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
    .value { margin-top: 2px; white-space: pre-wrap; word-break: break-word; }
    .note { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
    .note small { color: #64748b; }
    .muted { color: #64748b; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(report.reportTitle)}</h1>
  <div class="meta">${escapeHtml(BRAND)} · ${escapeHtml(report.caseId)} · Generated ${escapeHtml(report.generatedAtLabel)}</div>

  <h2>Report Details</h2>
  ${fieldHtml("Title", report.reportTitle)}
  ${report.reportStatus ? fieldHtml("Report Status", String(report.reportStatus).toUpperCase()) : ""}
  ${fieldHtml("Author", report.investigator)}

  <h2>Case Summary</h2>
  ${fieldHtml("Case ID", report.caseId)}
  ${fieldHtml("Crime Category", report.category)}
  ${fieldHtml("Investigator", report.investigator)}
  ${fieldHtml("Investigation Started", report.investigationStartedAtLabel)}
  ${fieldHtml("Resolved At", report.resolvedAtLabel)}
  ${fieldHtml("Resolved By", report.resolvedBy)}
  ${fieldHtml("Final Decision", report.decision)}

  <h2>Case Source</h2>
  ${fieldHtml("Source", report.source)}
  ${fieldHtml("AI Prediction", `${report.aiPrediction}${report.confidence != null ? ` (${report.confidence}%)` : ""}`)}
  ${report.matchedKeyword ? fieldHtml("Matched Keyword", report.matchedKeyword) : ""}
  ${fieldHtml("Incident Content", report.content)}

  <h2>Findings</h2>
  ${fieldHtml("What was discovered", report.findings)}

  <h2>Recommendation</h2>
  ${fieldHtml("Recommendation", report.reportRecommendation)}

  <h2>Investigation Notes</h2>
  ${notesHtml}

  <h2>Final Record</h2>
  ${fieldHtml("Decision", report.decision)}
  ${fieldHtml("Closure Time", report.resolvedAtLabel)}
  ${fieldHtml("Accountability", `${report.investigator} authored this investigation report.`)}

  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;

  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!win) {
    alert("Please allow pop-ups to print the investigation report.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function fieldHtml(label, value) {
  return `<div class="row"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(
    value
  )}</div></div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
