const InvestigationReport = require("../model/InvestigationReport");
const { resolveHistoryPostUrl } = require("./resolvePostUrl");

const formatCaseLabel = (caseId) =>
  `Case ${String(caseId || "").slice(-6).toUpperCase()}`;

const decisionLabel = (status) => {
  if (status === "crime_case") return "Crime Case — Confirmed";
  if (status === "not_crime") return "Not Crime — Dismissed";
  if (status === "investigating") return "Under Investigation";
  if (status === "pending") return "Pending Review";
  return String(status || "Open").replace(/_/g, " ");
};

/**
 * Build title / findings / recommendation from case + notes + history.
 * No manual form required — report content is derived automatically.
 */
const buildAutoReportFields = (investigationCase, { finalize = false } = {}) => {
  const history = investigationCase.history || {};
  const caseId = investigationCase._id;
  const notes = Array.isArray(investigationCase.notes)
    ? investigationCase.notes
    : [];

  const notesText = notes
    .map((n) => {
      const who = n.officer?.name || "Officer";
      const when = n.createdAt ? new Date(n.createdAt).toLocaleString() : "";
      return `- ${n.text}${when ? ` (${who}, ${when})` : ""}`;
    })
    .join("\n");

  const content = String(history.content || "").trim();
  const url = resolveHistoryPostUrl(history);
  const source = history.sourceType || history.type || null;
  const decision = decisionLabel(investigationCase.status);

  const findingsParts = [];
  if (content) {
    findingsParts.push(`Incident content:\n${content}`);
  }
  if (notesText) {
    findingsParts.push(`Investigation notes:\n${notesText}`);
  }
  if (investigationCase.findings) {
    findingsParts.push(`Recorded findings:\n${investigationCase.findings}`);
  }
  if (!findingsParts.length) {
    findingsParts.push("No findings recorded yet.");
  }

  const recommendationParts = [
    `Final decision: ${decision}.`,
  ];
  if (source) recommendationParts.push(`Source type: ${source}.`);
  if (url) recommendationParts.push(`Post / source link: ${url}`);
  if (finalize) {
    recommendationParts.push(
      "Case closed. This report was generated automatically from the investigation record."
    );
  } else {
    recommendationParts.push(
      "Draft auto-report — will finalize when the case is resolved."
    );
  }

  return {
    title: `Investigation Report — ${formatCaseLabel(caseId)}`,
    findings: findingsParts.join("\n\n"),
    recommendation: recommendationParts.join("\n"),
    status: finalize ? "finalized" : "draft",
  };
};

/**
 * Create or update the investigator's formal report for a case automatically.
 */
const syncAutoInvestigationReport = async ({
  investigationCase,
  investigatorId,
  finalize = false,
}) => {
  if (!investigationCase?._id || !investigatorId) return null;

  const fields = buildAutoReportFields(investigationCase, { finalize });

  const report = await InvestigationReport.findOneAndUpdate(
    {
      case: investigationCase._id,
      investigator: investigatorId,
    },
    {
      $set: {
        title: fields.title,
        findings: fields.findings,
        recommendation: fields.recommendation,
        status: fields.status,
      },
      $setOnInsert: {
        case: investigationCase._id,
        investigator: investigatorId,
      },
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  return report;
};

module.exports = {
  buildAutoReportFields,
  syncAutoInvestigationReport,
  decisionLabel,
  formatCaseLabel,
};
