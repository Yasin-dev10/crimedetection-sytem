/**
 * Suggested account_status from false-report flag count.
 * Applied automatically when an investigator flags a report.
 *
 * 1 flag  → warning
 * 2 flags → under_review
 * 3–4    → suspended
 * 5+     → blocked
 */
const FLAG_STATUSES = [
  "false_report",
  "misleading_information",
  "malicious_report",
];

const ACCOUNT_STATUSES = [
  "active",
  "warning",
  "under_review",
  "suspended",
  "blocked",
];

const suggestAccountStatus = (flagCount = 0) => {
  const count = Number(flagCount) || 0;
  if (count >= 5) return "blocked";
  if (count >= 3) return "suspended";
  if (count >= 2) return "under_review";
  if (count >= 1) return "warning";
  return "active";
};

const isLoginBlocked = (accountStatus) =>
  accountStatus === "blocked" || accountStatus === "suspended";

const FLAG_TYPE_LABELS = {
  false_report: "False Report",
  misleading_information: "Misleading Information",
  malicious_report: "Malicious Report",
};

module.exports = {
  FLAG_STATUSES,
  ACCOUNT_STATUSES,
  suggestAccountStatus,
  isLoginBlocked,
  FLAG_TYPE_LABELS,
};
