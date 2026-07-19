const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const CATEGORY_LABELS = {
  murder: "Murder",
  robbery: "Robbery",
  terrorism: "Terrorism",
  sexual_assault: "Sexual Assault",
  financial_fraud: "Financial Fraud",
  drug_crimes: "Drug Crimes",
  cybercrime: "Cybercrime",
  general: "General",
};

const STATUS_LABELS = {
  pending: "Pending",
  investigating: "Investigating",
  crime_case: "Confirmed Crime",
  not_crime: "Not Crime-Related",
  resolved: "Resolved",
  archived: "Archived",
};

const formatLabel = (value, map) =>
  map[value] ||
  String(value || "Unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getCaseAssignmentDetails = (investigationCase, officer = {}) => {
  const source =
    investigationCase.history?.sourceType ||
    investigationCase.history?.type ||
    "crime";
  const category = formatLabel(investigationCase.category, CATEGORY_LABELS);
  const status = formatLabel(investigationCase.status, STATUS_LABELS);
  const contentPreview = String(investigationCase.history?.content || "")
    .replace(/\s+/g, " ")
    .trim();
  const appUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const caseUrl = `${appUrl}/investigator`;
  const officerName = officer.name || "Investigator";
  const station = officer.station || "Not specified";
  const assignedAt = new Date().toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return {
    source: formatLabel(source, {}),
    category,
    status,
    contentPreview,
    shortPreview: contentPreview.slice(0, 140),
    smsPreview: contentPreview.slice(0, 90),
    appUrl,
    caseUrl,
    officerName,
    station,
    assignedAt,
  };
};

const buildCaseAssignmentSms = (investigationCase, officer = {}) => {
  const details = getCaseAssignmentDetails(investigationCase, officer);

  return [
    "BAAREAI — New Case Assigned",
    `Hi ${details.officerName.split(" ")[0]},`,
    `Category: ${details.category}`,
    `Status: ${details.status}`,
    `Source: ${details.source}`,
    details.smsPreview ? `Preview: "${details.smsPreview}${details.contentPreview.length > 90 ? "..." : ""}"` : null,
    `View: ${details.caseUrl}`,
  ]
    .filter(Boolean)
    .join("\n");
};

const buildCaseAssignmentEmailHtml = (investigationCase, officer = {}) => {
  const details = getCaseAssignmentDetails(investigationCase, officer);
  const preview = escapeHtml(details.contentPreview.slice(0, 800));

  return `
    <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 40px; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 28px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #0891b2); padding: 14px 24px; border-radius: 12px; font-size: 26px; font-weight: 900; color: #fff; letter-spacing: 2px;">
          BAAREAI
        </div>
      </div>

      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: rgba(6, 182, 212, 0.12); border: 1px solid rgba(6, 182, 212, 0.35); color: #67e8f9; padding: 8px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">
          New Investigation Case
        </div>
      </div>

      <h2 style="color: #f1f5f9; font-size: 24px; margin: 0 0 8px; text-align: center;">Case Assigned to You</h2>
      <p style="color: #94a3b8; margin: 0 0 28px; text-align: center;">
        Hello <strong style="color: #e2e8f0;">${escapeHtml(details.officerName)}</strong>,
        an admin has assigned a new case for your review.
      </p>

      <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 13px; width: 120px;">Category</td>
            <td style="padding: 10px 0; color: #f8fafc; font-weight: 700;">${escapeHtml(details.category)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Status</td>
            <td style="padding: 10px 0; color: #22d3ee; font-weight: 700;">${escapeHtml(details.status)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Source</td>
            <td style="padding: 10px 0; color: #f8fafc; font-weight: 600;">${escapeHtml(details.source)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Station</td>
            <td style="padding: 10px 0; color: #f8fafc;">${escapeHtml(details.station)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-size: 13px;">Assigned</td>
            <td style="padding: 10px 0; color: #f8fafc;">${escapeHtml(details.assignedAt)}</td>
          </tr>
        </table>
      </div>

      ${
        preview
          ? `
      <div style="background: #111827; border: 1px solid #374151; border-left: 4px solid #06b6d4; border-radius: 10px; padding: 20px; margin-bottom: 28px;">
        <p style="color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 12px;">Case Preview</p>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.7; margin: 0; white-space: pre-wrap;">${preview}${details.contentPreview.length > 800 ? "..." : ""}</p>
      </div>`
          : ""
      }

      <div style="text-align: center; margin-bottom: 28px;">
        <a href="${details.caseUrl}" style="display: inline-block; background: linear-gradient(135deg, #06b6d4, #0891b2); color: #fff; font-weight: 700; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-size: 15px;">
          Open Assigned Cases →
        </a>
      </div>

      <div style="background: #1e293b; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 16px; margin-bottom: 12px;">
        <p style="color: #fbbf24; font-size: 13px; margin: 0;">
          Please review this case promptly and update the investigation status in BAAREAI.
        </p>
      </div>

      <p style="color: #475569; font-size: 12px; text-align: center; margin: 0;">
        This is an automated notification from BAAREAI Crime Detection System.
      </p>
    </div>
  `;
};

module.exports = {
  getCaseAssignmentDetails,
  buildCaseAssignmentSms,
  buildCaseAssignmentEmailHtml,
};
