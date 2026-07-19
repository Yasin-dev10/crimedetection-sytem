import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const BRAND = "BAREAI";
const COLORS = {
  primary: "#1E3A8A",
  primaryDark: "#172554",
  crime: "#dc2626",
  safe: "#06B6D4",
  muted: "#64748b",
  border: "#cbd5e1",
  sectionBg: "#f1f5f9",
  white: "#ffffff",
};

function formatReportType(type) {
  const labels = {
    general: "General",
    individual: "Blacklist",
    monthly: "Monthly",
    weekly: "Weekly",
    "investigator-activity": "Investigator Activity",
    "fake-crimes-full": "Fake Crimes Full",
    "fake-crimes-individual": "Fake Crime Individual",
  };
  return labels[type] || String(type || "Report");
}

function isFakeCrimesReport(report) {
  return (
    report?.reportType === "fake-crimes-full"
    || report?.reportType === "fake-crimes-individual"
  );
}

function formatExportDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function getFakeCrimeEvidenceRows(report) {
  const fromRecords = report.records || [];
  if (fromRecords.length) {
    return fromRecords.map((r) => ({
      subject: r.subjectName || "—",
      type: r.subjectType || "—",
      value: r.subjectValue || "—",
      fakeCount: r.fakeCount ?? "",
      content: (r.content || "").replace(/\s+/g, " ").trim(),
      source: r.sourceType || "—",
      author: r.authorName || "—",
      page: r.pageName || "—",
      investigator: r.resolvedByName || "—",
      badge: r.resolvedByBadge || "—",
      email: r.resolvedByEmail || "—",
      resolvedAt: formatExportDate(r.resolvedAt),
      caseId: r.caseId || "—",
      historyId: r.historyId || "—",
      url: r.url || "—",
      subjectId: r.subjectId || "—",
    }));
  }

  const rows = [];
  (report.subjects || []).forEach((subject) => {
    const item = subject.item || {};
    const evidence = subject.evidence || [];
    if (!evidence.length) {
      rows.push({
        subject: item.name || "—",
        type: item.type || "—",
        value: item.value || "—",
        fakeCount: subject.fakeCount ?? "",
        content: "",
        source: "—",
        author: "—",
        page: "—",
        investigator: "—",
        badge: "—",
        email: "—",
        resolvedAt: "—",
        caseId: "—",
        historyId: "—",
        url: "—",
        subjectId: item._id || "—",
      });
      return;
    }
    evidence.forEach((entry) => {
      rows.push({
        subject: item.name || "—",
        type: item.type || "—",
        value: item.value || "—",
        fakeCount: subject.fakeCount ?? "",
        content: (entry.content || "").replace(/\s+/g, " ").trim(),
        source: entry.sourceType || "—",
        author: entry.authorName || "—",
        page: entry.pageName || "—",
        investigator: entry.resolvedByName || entry.resolvedBy?.name || "—",
        badge: entry.resolvedByBadge || entry.resolvedBy?.badgeNumber || "—",
        email: entry.resolvedByEmail || entry.resolvedBy?.email || "—",
        resolvedAt: formatExportDate(entry.resolvedAt),
        caseId: entry.caseId || "—",
        historyId: entry.historyId || "—",
        url: entry.url || "—",
        subjectId: item._id || "—",
      });
    });
  });
  return rows;
}

const FAKE_CRIME_EVIDENCE_HEADERS = [
  "Subject",
  "Type",
  "Value",
  "Fake Count",
  "Content",
  "Source",
  "Author",
  "Page",
  "Investigator",
  "Badge",
  "Investigator Email",
  "Resolved At",
  "Case ID",
  "History ID",
  "URL",
];

function fakeCrimeRowToArray(row) {
  return [
    row.subject,
    row.type,
    row.value,
    row.fakeCount,
    row.content,
    row.source,
    row.author,
    row.page,
    row.investigator,
    row.badge,
    row.email,
    row.resolvedAt,
    row.caseId,
    row.historyId,
    row.url,
  ];
}

function buildFakeCrimesReportSections(report) {
  const evidenceRows = getFakeCrimeEvidenceRows(report);
  return {
    meta: {
      brand: BRAND,
      title: `${formatReportType(report.reportType)} Report`,
      reportType: formatReportType(report.reportType),
      period: report.period || "All investigator-confirmed fake crimes",
      generatedAt: report.generatedAt
        ? new Date(report.generatedAt).toLocaleString()
        : "—",
      blacklistItem: report.blacklistItem || null,
      threshold: report.threshold ?? report.stats?.threshold ?? 3,
    },
    stats: [
      { label: "Subjects", value: report.stats?.subjects ?? (report.subjects || []).length, tone: "primary" },
      { label: "Total Fake Reports", value: report.stats?.totalFakeReports ?? 0, tone: "crime" },
      { label: "Threshold", value: report.stats?.threshold ?? report.threshold ?? 3, tone: "safe" },
    ],
    subjects: (report.subjects || []).map((s) => ({
      name: s.item?.name || "—",
      type: s.item?.type || "—",
      value: s.item?.value || "—",
      fakeCount: s.fakeCount ?? 0,
      latest: formatExportDate(s.latestOccurrenceAt),
      evidenceCount: (s.evidence || []).length,
    })),
    evidenceRows,
  };
}

function buildFakeCrimesReportRows(report) {
  const sections = buildFakeCrimesReportSections(report);
  const rows = [
    ["Report Type", sections.meta.reportType],
    ["Period", sections.meta.period],
    ["Generated", sections.meta.generatedAt],
    ["Threshold", sections.meta.threshold],
  ];

  if (sections.meta.blacklistItem) {
    rows.push(
      [],
      ["BLACKLIST ITEM"],
      ["Name", sections.meta.blacklistItem.name || "—"],
      ["Type", sections.meta.blacklistItem.type || "—"],
      ["Value", sections.meta.blacklistItem.value || "—"]
    );
  }

  rows.push([], ["SUMMARY STATS"], ["Metric", "Value"]);
  sections.stats.forEach((s) => rows.push([s.label, s.value]));

  if (sections.subjects.length) {
    rows.push(
      [],
      ["SUBJECTS"],
      ["Name", "Type", "Value", "Fake Count", "Latest Occurrence", "Evidence Count"]
    );
    sections.subjects.forEach((s) =>
      rows.push([s.name, s.type, s.value, s.fakeCount, s.latest, s.evidenceCount])
    );
  }

  if (sections.evidenceRows.length) {
    rows.push([], ["FAKE CRIME EVIDENCE"], FAKE_CRIME_EVIDENCE_HEADERS);
    sections.evidenceRows.forEach((r) => rows.push(fakeCrimeRowToArray(r)));
  }

  return rows;
}

function buildInvestigatorActivityRows(report) {
  const rows = [
    ["Report Type", formatReportType(report.reportType)],
    ["Period", report.period || "—"],
    ["Generated", report.generatedAt ? new Date(report.generatedAt).toLocaleString() : "—"],
    [],
    ["SUMMARY STATS"],
    ["Metric", "Value"],
    ["Investigators", report.stats?.investigators ?? 0],
    ["Total Cases", report.stats?.totalCases ?? 0],
    ["Resolved Cases", report.stats?.resolvedCases ?? 0],
    ["Unresolved Cases", report.stats?.unresolvedCases ?? 0],
    ["Resolved In Period", report.stats?.resolvedInPeriod ?? 0],
    ["Logged In In Period", report.stats?.loggedInInPeriod ?? 0],
    [],
    ["INVESTIGATORS"],
    [
      "Name",
      "Email",
      "Badge",
      "Station",
      "Status",
      "Total Cases",
      "Resolved",
      "Unresolved",
      "Resolved In Period",
      "Logged In",
      "Last Login",
      "Last Logout",
      "Activity Count",
    ],
  ];

  (report.investigators || []).forEach((inv) => {
    rows.push([
      inv.name || "—",
      inv.email || "—",
      inv.badgeNumber || "—",
      inv.station || "—",
      inv.status || "—",
      inv.totalCases ?? 0,
      inv.resolvedCases ?? 0,
      inv.unresolvedCases ?? 0,
      inv.resolvedInPeriod ?? 0,
      inv.loggedInInPeriod ? "Yes" : "No",
      inv.lastLoginAt ? new Date(inv.lastLoginAt).toLocaleString() : "—",
      inv.lastLogoutAt ? new Date(inv.lastLogoutAt).toLocaleString() : "—",
      inv.activityCount ?? (inv.activities || []).length,
    ]);
  });

  return rows;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getBlacklistLabel(record) {
  const matches = record.blacklistMatches || [];
  if (!matches.length) return "";
  return matches
    .map((match) => match.name || match.value || match.type || "blacklist")
    .filter(Boolean)
    .join(", ");
}

function getReportFileBase(report) {
  const period = String(report.period || "report")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return `${report.reportType || "report"}_${period || "report"}_${Date.now()}`;
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

function buildReportSections(report) {
  const exportRecords = report.records || report.recentRecords || [];
  return {
    meta: {
      brand: BRAND,
      title: `${formatReportType(report.reportType)} Analysis Report`,
      reportType: formatReportType(report.reportType),
      period: report.period || "—",
      generatedAt: new Date(report.generatedAt).toLocaleString(),
      blacklistItem: report.blacklistItem || null,
    },
    stats: [
      { label: "Total Analysis", value: report.stats?.total ?? 0, tone: "primary" },
      { label: "Crime Detected", value: report.stats?.crime ?? 0, tone: "crime" },
      { label: "Not Crime", value: report.stats?.notCrime ?? 0, tone: "safe" },
    ],
    blacklist: report.blacklist
      ? [
          { label: "Blacklist Items", value: report.blacklist.items || 0 },
          { label: "Active Items", value: report.blacklist.activeItems || 0 },
          { label: "Matches", value: report.blacklist.matches || 0 },
          { label: "Crime Matches", value: report.blacklist.crimeMatches || 0 },
          { label: "Not-Crime Matches", value: report.blacklist.notCrimeMatches || 0 },
          { label: "Alerts", value: report.blacklist.alerts || 0 },
        ]
      : [],
    sourceBreakdown: report.sourceBreakdown || [],
    dailyBreakdown: report.dailyBreakdown || [],
    topMatches: report.blacklist?.topMatches || [],
    records: exportRecords.map((r) => ({
      type: r.type || "—",
      source: r.sourceType || "—",
      status: r.isCrime ? "CRIME" : "NOT CRIME",
      confidence: `${r.confidence ?? 0}%`,
      blacklist: getBlacklistLabel(r) || "—",
      date: r.createdAt ? new Date(r.createdAt).toLocaleString() : "—",
      content: (r.content || "").replace(/\s+/g, " ").trim().slice(0, 300),
    })),
  };
}

function buildReportRows(report) {
  const sections = buildReportSections(report);
  const rows = [
    ["Report Type", sections.meta.reportType],
    ["Period", sections.meta.period],
    ["Generated", sections.meta.generatedAt],
  ];

  if (sections.meta.blacklistItem) {
    rows.push(
      [],
      ["BLACKLIST ITEM"],
      ["Name", sections.meta.blacklistItem.name || "—"],
      ["Type", sections.meta.blacklistItem.type || "—"],
      ["Value", sections.meta.blacklistItem.value || "—"]
    );
  }

  rows.push([], ["SUMMARY STATS"], ["Metric", "Value"]);
  sections.stats.forEach((s) => rows.push([s.label, s.value]));

  if (sections.blacklist.length) {
    rows.push([], ["BLACKLIST SUMMARY"], ["Metric", "Value"]);
    sections.blacklist.forEach((s) => rows.push([s.label, s.value]));
  }

  if (sections.sourceBreakdown.length) {
    rows.push([], ["SOURCE BREAKDOWN"], ["Source", "Count"]);
    sections.sourceBreakdown.forEach((s) => rows.push([s.source, s.count]));
  }

  if (sections.dailyBreakdown.length) {
    rows.push([], ["DAILY BREAKDOWN"], ["Date", "Day", "Crime", "Not Crime", "Total"]);
    sections.dailyBreakdown.forEach((d) =>
      rows.push([d.date, d.day || "", d.crime, d.notCrime, d.total])
    );
  }

  if (sections.topMatches.length) {
    rows.push([], ["TOP BLACKLIST MATCHES"], ["Name", "Type", "Value", "Count"]);
    sections.topMatches.forEach((m) =>
      rows.push([m.name || m.value, m.type, m.value, m.count])
    );
  }

  if (sections.records.length) {
    rows.push(
      [],
      ["RECORDS"],
      ["Type", "Source", "Status", "Confidence", "Blacklist", "Date", "Content"]
    );
    sections.records.forEach((r) =>
      rows.push([
        r.type,
        r.source,
        r.status,
        r.confidence,
        r.blacklist,
        r.date,
        r.content,
      ])
    );
  }

  return rows;
}

function kpiToneColor(tone) {
  if (tone === "crime") return COLORS.crime;
  if (tone === "safe") return COLORS.safe;
  return COLORS.primary;
}

function buildFakeCrimesExcelHtml(report) {
  const s = buildFakeCrimesReportSections(report);

  const kpiCells = s.stats
    .map(
      (item) => `
        <td class="kpi-cell" style="border-color:${kpiToneColor(item.tone)}">
          <div class="kpi-label">${escapeHtml(item.label)}</div>
          <div class="kpi-value" style="color:${kpiToneColor(item.tone)}">${escapeHtml(item.value)}</div>
        </td>`
    )
    .join("");

  const tableSection = (title, headers, rows, rowMapper) => {
    if (!rows.length) return "";
    const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
    const body = rows.map((row) => `<tr>${rowMapper(row)}</tr>`).join("");
    return `
      <div class="section">
        <div class="section-title">${escapeHtml(title)}</div>
        <table class="data-table">
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  };

  const blacklistMeta = s.meta.blacklistItem
    ? `
      <div class="meta-box">
        <div class="meta-title">Blacklist Focus</div>
        <div><strong>Name:</strong> ${escapeHtml(s.meta.blacklistItem.name || "—")}</div>
        <div><strong>Type:</strong> ${escapeHtml(s.meta.blacklistItem.type || "—")}</div>
        <div><strong>Value:</strong> ${escapeHtml(s.meta.blacklistItem.value || "—")}</div>
      </div>`
    : "";

  return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(s.meta.title)}</title>
  <style>
    body { font-family: Calibri, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #f8fafc; }
    .report { max-width: 1200px; margin: 0 auto; background: #fff; border: 1px solid ${COLORS.border}; }
    .header { background: ${COLORS.primaryDark}; color: #fff; padding: 28px 32px; }
    .brand { font-size: 13px; letter-spacing: 0.22em; text-transform: uppercase; opacity: 0.85; }
    .title { font-size: 28px; font-weight: 700; margin: 8px 0 4px; }
    .subtitle { font-size: 15px; opacity: 0.92; }
    .meta-line { font-size: 12px; opacity: 0.8; margin-top: 10px; }
    .content { padding: 28px 32px 36px; }
    .kpi-table { width: 100%; border-collapse: separate; border-spacing: 12px 0; margin: 0 0 24px; }
    .kpi-cell { width: 33%; background: #f8fafc; border: 2px solid ${COLORS.primary}; border-radius: 12px; padding: 18px 16px; vertical-align: top; }
    .kpi-label { font-size: 12px; color: ${COLORS.muted}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
    .kpi-value { font-size: 32px; font-weight: 700; margin-top: 8px; }
    .meta-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 16px 18px; margin-bottom: 24px; font-size: 13px; line-height: 1.7; }
    .meta-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: ${COLORS.primary}; font-weight: 700; margin-bottom: 8px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 14px; font-weight: 700; color: ${COLORS.primaryDark}; text-transform: uppercase; letter-spacing: 0.08em; padding: 10px 14px; background: ${COLORS.sectionBg}; border-left: 4px solid ${COLORS.primary}; margin-bottom: 10px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .data-table th, .data-table td { border: 1px solid ${COLORS.border}; padding: 8px 10px; vertical-align: top; }
    .data-table th { background: ${COLORS.primary}; color: #fff; text-align: left; font-weight: 700; }
    .data-table tr:nth-child(even) td { background: #f8fafc; }
    .footer { padding: 18px 32px 28px; border-top: 1px solid ${COLORS.border}; font-size: 11px; color: ${COLORS.muted}; }
  </style>
</head>
<body>
  <div class="report">
    <div class="header">
      <div class="brand">${escapeHtml(s.meta.brand)}</div>
      <div class="title">${escapeHtml(s.meta.title)}</div>
      <div class="subtitle">${escapeHtml(s.meta.period)}</div>
      <div class="meta-line">Generated: ${escapeHtml(s.meta.generatedAt)} · Threshold: ${escapeHtml(s.meta.threshold)}</div>
    </div>
    <div class="content">
      ${blacklistMeta}
      <table class="kpi-table"><tr>${kpiCells}</tr></table>
      ${tableSection(
        "Subjects",
        ["Name", "Type", "Value", "Fake Count", "Latest Occurrence", "Evidence Count"],
        s.subjects,
        (row) =>
          `<td>${escapeHtml(row.name)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.value)}</td><td>${escapeHtml(row.fakeCount)}</td><td>${escapeHtml(row.latest)}</td><td>${escapeHtml(row.evidenceCount)}</td>`
      )}
      ${tableSection(
        "Fake Crime Evidence",
        FAKE_CRIME_EVIDENCE_HEADERS,
        s.evidenceRows,
        (row) =>
          fakeCrimeRowToArray(row)
            .map((cell) => `<td>${escapeHtml(cell)}</td>`)
            .join("")
      )}
    </div>
    <div class="footer">
      Confidential — ${escapeHtml(BRAND)} Crime Analysis Platform. Fake crime evidence export.
    </div>
  </div>
</body>
</html>`;
}

function buildExcelHtml(report) {
  if (isFakeCrimesReport(report)) {
    return buildFakeCrimesExcelHtml(report);
  }

  const s = buildReportSections(report);

  const kpiCells = s.stats
    .map(
      (item) => `
        <td class="kpi-cell" style="border-color:${kpiToneColor(item.tone)}">
          <div class="kpi-label">${escapeHtml(item.label)}</div>
          <div class="kpi-value" style="color:${kpiToneColor(item.tone)}">${escapeHtml(item.value)}</div>
        </td>`
    )
    .join("");

  const blacklistRows = s.blacklist
    .map(
      (item) => `
        <tr>
          <td class="metric-label">${escapeHtml(item.label)}</td>
          <td class="metric-value">${escapeHtml(item.value)}</td>
        </tr>`
    )
    .join("");

  const tableSection = (title, headers, rows, rowMapper) => {
    if (!rows.length) return "";
    const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
    const body = rows.map((row) => `<tr>${rowMapper(row)}</tr>`).join("");
    return `
      <div class="section">
        <div class="section-title">${escapeHtml(title)}</div>
        <table class="data-table">
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  };

  const blacklistMeta = s.meta.blacklistItem
    ? `
      <div class="meta-box">
        <div class="meta-title">Blacklist Focus</div>
        <div><strong>Name:</strong> ${escapeHtml(s.meta.blacklistItem.name || "—")}</div>
        <div><strong>Type:</strong> ${escapeHtml(s.meta.blacklistItem.type || "—")}</div>
        <div><strong>Value:</strong> ${escapeHtml(s.meta.blacklistItem.value || "—")}</div>
      </div>`
    : "";

  return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(s.meta.title)}</title>
  <style>
    body { font-family: Calibri, Arial, sans-serif; color: #0f172a; margin: 0; padding: 24px; background: #f8fafc; }
    .report { max-width: 1100px; margin: 0 auto; background: #fff; border: 1px solid ${COLORS.border}; }
    .header { background: ${COLORS.primaryDark}; color: #fff; padding: 28px 32px; }
    .brand { font-size: 13px; letter-spacing: 0.22em; text-transform: uppercase; opacity: 0.85; }
    .title { font-size: 28px; font-weight: 700; margin: 8px 0 4px; }
    .subtitle { font-size: 15px; opacity: 0.92; }
    .meta-line { font-size: 12px; opacity: 0.8; margin-top: 10px; }
    .content { padding: 28px 32px 36px; }
    .kpi-table { width: 100%; border-collapse: separate; border-spacing: 12px 0; margin: 0 0 24px; }
    .kpi-cell { width: 33%; background: #f8fafc; border: 2px solid ${COLORS.primary}; border-radius: 12px; padding: 18px 16px; vertical-align: top; }
    .kpi-label { font-size: 12px; color: ${COLORS.muted}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
    .kpi-value { font-size: 32px; font-weight: 700; margin-top: 8px; }
    .meta-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 16px 18px; margin-bottom: 24px; font-size: 13px; line-height: 1.7; }
    .meta-title { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: ${COLORS.primary}; font-weight: 700; margin-bottom: 8px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 14px; font-weight: 700; color: ${COLORS.primaryDark}; text-transform: uppercase; letter-spacing: 0.08em; padding: 10px 14px; background: ${COLORS.sectionBg}; border-left: 4px solid ${COLORS.primary}; margin-bottom: 10px; }
    .metric-table, .data-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .metric-table td, .data-table th, .data-table td { border: 1px solid ${COLORS.border}; padding: 10px 12px; }
    .metric-label { background: #f8fafc; font-weight: 600; width: 40%; }
    .metric-value { font-weight: 700; }
    .data-table th { background: ${COLORS.primary}; color: #fff; text-align: left; font-weight: 700; }
    .data-table tr:nth-child(even) td { background: #f8fafc; }
    .status-crime { color: ${COLORS.crime}; font-weight: 700; }
    .status-safe { color: ${COLORS.safe}; font-weight: 700; }
    .footer { padding: 18px 32px 28px; border-top: 1px solid ${COLORS.border}; font-size: 11px; color: ${COLORS.muted}; }
  </style>
</head>
<body>
  <div class="report">
    <div class="header">
      <div class="brand">${escapeHtml(s.meta.brand)}</div>
      <div class="title">${escapeHtml(s.meta.title)}</div>
      <div class="subtitle">${escapeHtml(s.meta.period)}</div>
      <div class="meta-line">Generated: ${escapeHtml(s.meta.generatedAt)}</div>
    </div>
    <div class="content">
      ${blacklistMeta}
      <table class="kpi-table"><tr>${kpiCells}</tr></table>
      ${
        s.blacklist.length
          ? `<div class="section">
              <div class="section-title">Blacklist Summary</div>
              <table class="metric-table">${blacklistRows}</table>
            </div>`
          : ""
      }
      ${tableSection("Source Breakdown", ["Source", "Count"], s.sourceBreakdown, (row) =>
        `<td>${escapeHtml(row.source)}</td><td>${escapeHtml(row.count)}</td>`
      )}
      ${tableSection(
        "Daily Breakdown",
        ["Date", "Day", "Crime", "Not Crime", "Total"],
        s.dailyBreakdown,
        (row) =>
          `<td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.day || "")}</td><td>${escapeHtml(row.crime)}</td><td>${escapeHtml(row.notCrime)}</td><td>${escapeHtml(row.total)}</td>`
      )}
      ${tableSection(
        "Top Blacklist Matches",
        ["Name", "Type", "Value", "Count"],
        s.topMatches,
        (row) =>
          `<td>${escapeHtml(row.name || row.value)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.value)}</td><td>${escapeHtml(row.count)}</td>`
      )}
      ${tableSection(
        "Analysis Records",
        ["Type", "Source", "Status", "Confidence", "Blacklist", "Date", "Content"],
        s.records,
        (row) => {
          const statusClass = row.status === "CRIME" ? "status-crime" : "status-safe";
          return `<td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.source)}</td><td class="${statusClass}">${escapeHtml(row.status)}</td><td>${escapeHtml(row.confidence)}</td><td>${escapeHtml(row.blacklist)}</td><td>${escapeHtml(row.date)}</td><td>${escapeHtml(row.content)}</td>`;
        }
      )}
    </div>
    <div class="footer">
      Confidential — ${escapeHtml(BRAND)} Crime Analysis Platform. This report is generated automatically from system data.
    </div>
  </div>
</body>
</html>`;
}

function drawPdfHeader(doc, sections, pageWidth) {
  doc.setFillColor(30, 58, 95);
  doc.rect(0, 0, pageWidth, 34, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(BRAND, 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(sections.meta.title, 14, 20);
  doc.text(`${sections.meta.period}  |  ${sections.meta.generatedAt}`, 14, 27);
}

function addSectionTitle(doc, y, title) {
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(61, 107, 140);
  doc.setLineWidth(0.8);
  doc.rect(14, y, 182, 8, "FD");
  doc.line(14, y, 14, y + 8);
  doc.setTextColor(30, 58, 95);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(title.toUpperCase(), 18, y + 5.5);
  return y + 12;
}

function buildFakeCrimesPdf(report) {
  const sections = buildFakeCrimesReportSections(report);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 42;

  drawPdfHeader(doc, sections, pageWidth);

  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Threshold: ${sections.meta.threshold}`, 14, y);
  y += 6;

  if (sections.meta.blacklistItem) {
    doc.text(
      `Blacklist: ${sections.meta.blacklistItem.name || "—"}  |  ${sections.meta.blacklistItem.type || "—"}  |  ${sections.meta.blacklistItem.value || "—"}`,
      14,
      y
    );
    y += 8;
  }

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Metric", "Value"]],
    body: sections.stats.map((item) => [item.label, String(item.value)]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [61, 107, 140], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: "bold", textColor: [71, 85, 105] },
      1: { cellWidth: 40, halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 8;

  const addTable = (title, head, body, options = {}) => {
    if (!body.length) return;
    if (y > pageHeight - 40) {
      doc.addPage();
      drawPdfHeader(doc, sections, pageWidth);
      y = 42;
    }
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(61, 107, 140);
    doc.setLineWidth(0.8);
    doc.rect(14, y, pageWidth - 28, 8, "FD");
    doc.line(14, y, 14, y + 8);
    doc.setTextColor(30, 58, 95);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(title.toUpperCase(), 18, y + 5.5);
    y += 12;
    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [head],
      body,
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [61, 107, 140], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      ...options,
    });
    y = doc.lastAutoTable.finalY + 8;
  };

  addTable(
    "Subjects",
    ["Name", "Type", "Value", "Fake Count", "Latest", "Evidence"],
    sections.subjects.map((row) => [
      row.name,
      row.type,
      row.value,
      String(row.fakeCount),
      row.latest,
      String(row.evidenceCount),
    ])
  );

  addTable(
    "Fake Crime Evidence",
    FAKE_CRIME_EVIDENCE_HEADERS,
    sections.evidenceRows.map((row) =>
      fakeCrimeRowToArray(row).map((cell) => String(cell ?? ""))
    ),
    {
      columnStyles: {
        4: { cellWidth: 45 },
        14: { cellWidth: 35 },
      },
    }
  );

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 28, pageHeight - 8);
    doc.text("Confidential — BAREAI Fake Crimes Report", 14, pageHeight - 8);
  }

  return doc.output("blob");
}

function buildPdf(report) {
  if (isFakeCrimesReport(report)) {
    return buildFakeCrimesPdf(report);
  }

  const sections = buildReportSections(report);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 42;

  drawPdfHeader(doc, sections, pageWidth);

  if (sections.meta.blacklistItem) {
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      `Blacklist: ${sections.meta.blacklistItem.name || "—"}  |  ${sections.meta.blacklistItem.type || "—"}  |  ${sections.meta.blacklistItem.value || "—"}`,
      14,
      y
    );
    y += 8;
  }

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Metric", "Value"]],
    body: sections.stats.map((item) => [item.label, String(item.value)]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [61, 107, 140], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 70, fontStyle: "bold", textColor: [71, 85, 105] },
      1: { cellWidth: 40, halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });
  y = doc.lastAutoTable.finalY + 8;

  const addTable = (title, head, body, options = {}) => {
    if (!body.length) return;
    if (y > 250) {
      doc.addPage();
      drawPdfHeader(doc, sections, pageWidth);
      y = 42;
    }
    y = addSectionTitle(doc, y, title);
    autoTable(doc, {
      startY: y,
      theme: "grid",
      head: [head],
      body,
      styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: { fillColor: [61, 107, 140], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      ...options,
    });
    y = doc.lastAutoTable.finalY + 8;
  };

  if (sections.blacklist.length) {
    addTable(
      "Blacklist Summary",
      ["Metric", "Value"],
      sections.blacklist.map((item) => [item.label, String(item.value)])
    );
  }

  addTable(
    "Source Breakdown",
    ["Source", "Count"],
    sections.sourceBreakdown.map((row) => [row.source, String(row.count)])
  );

  addTable(
    "Daily Breakdown",
    ["Date", "Day", "Crime", "Not Crime", "Total"],
    sections.dailyBreakdown.map((row) => [
      row.date,
      row.day || "",
      String(row.crime),
      String(row.notCrime),
      String(row.total),
    ])
  );

  addTable(
    "Top Blacklist Matches",
    ["Name", "Type", "Count"],
    sections.topMatches.map((row) => [
      row.name || row.value,
      row.type,
      String(row.count),
    ])
  );

  addTable(
    "Analysis Records",
    ["Type", "Source", "Status", "Conf.", "Date", "Content"],
    sections.records.map((row) => [
      row.type,
      row.source,
      row.status,
      row.confidence,
      row.date,
      row.content,
    ]),
    {
      columnStyles: {
        5: { cellWidth: 58 },
      },
    }
  );

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 28, 290);
    doc.text("Confidential — BAREAI Crime Analysis Report", 14, 290);
  }

  return doc.output("blob");
}

export function exportReportCSV(report) {
  let rows;
  if (report?.reportType === "investigator-activity") {
    rows = buildInvestigatorActivityRows(report);
  } else if (isFakeCrimesReport(report)) {
    rows = buildFakeCrimesReportRows(report);
  } else {
    rows = buildReportRows(report);
  }
  const csv = rows
    .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  downloadBlob(csv, `${getReportFileBase(report)}.csv`, "text/csv;charset=utf-8");
}

export function exportReportExcel(report) {
  const html = buildExcelHtml(report);
  downloadBlob(
    html,
    `${getReportFileBase(report)}.xls`,
    "application/vnd.ms-excel;charset=utf-8"
  );
}

export function exportReportPDF(report) {
  const pdfBlob = buildPdf(report);
  downloadBlob(pdfBlob, `${getReportFileBase(report)}.pdf`, "application/pdf");
}

export { buildReportRows, getReportFileBase, buildFakeCrimesReportRows, isFakeCrimesReport };
