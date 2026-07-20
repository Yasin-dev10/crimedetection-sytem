/**
 * Maps activity actions → module + human-readable labels for Audit Logs.
 */
const ACTION_META = {
  login: {
    module: "Authentication",
    label: "Login success",
  },
  login_failed: {
    module: "Authentication",
    label: "Login failed",
  },
  logout: {
    module: "Authentication",
    label: "Logout",
  },
  multiple_failed_logins: {
    module: "Authentication",
    label: "Multiple failed login attempts",
  },

  user_created: {
    module: "User Management",
    label: "User created",
  },
  user_updated: {
    module: "User Management",
    label: "User updated",
  },
  user_deleted: {
    module: "User Management",
    label: "User deleted",
  },
  password_reset: {
    module: "User Management",
    label: "Password reset",
  },
  role_changed: {
    module: "User Management",
    label: "Role changed",
  },

  blacklist_entry_added: {
    module: "Blacklist Management",
    label: "Blacklist entry added",
  },
  blacklist_entry_updated: {
    module: "Blacklist Management",
    label: "Blacklist entry updated",
  },
  blacklist_entry_removed: {
    module: "Blacklist Management",
    label: "Blacklist entry removed",
  },

  case_created: {
    module: "Case Management",
    label: "Case created",
  },
  case_updated: {
    module: "Case Management",
    label: "Case updated",
  },
  case_assigned: {
    module: "Case Management",
    label: "Case assigned",
  },
  case_claimed: {
    module: "Case Management",
    label: "Case claimed",
  },
  case_status_changed: {
    module: "Case Management",
    label: "Case status changed",
  },
  case_resolved: {
    module: "Case Management",
    label: "Case closed",
  },
  case_note_added: {
    module: "Case Management",
    label: "Case note added",
  },
  report_flagged: {
    module: "Case Management",
    label: "Report flagged as false/malicious",
  },
  report_flag_confirmed: {
    module: "Case Management",
    label: "Report flag confirmed by admin",
  },
  report_flag_rejected: {
    module: "Case Management",
    label: "Report flag rejected by admin",
  },
  account_sanctioned: {
    module: "User Management",
    label: "Account sanctioned after false report",
  },

  investigation_report_created: {
    module: "Case Management",
    label: "Investigation report created",
  },
  investigation_report_updated: {
    module: "Case Management",
    label: "Investigation report updated",
  },
  investigation_report_deleted: {
    module: "Case Management",
    label: "Investigation report deleted",
  },

  report_generated: {
    module: "Reports",
    label: "Report generated",
  },
  report_exported: {
    module: "Reports",
    label: "Report exported",
  },
};

const MODULES = [
  "Authentication",
  "User Management",
  "Blacklist Management",
  "Case Management",
  "Reports",
];

/** Modules supervisors (mapped to admin extras) / investigators may see beyond own logs */
const SUPERVISOR_MODULES = ["Case Management", "User Management"];

const getActionMeta = (action) => {
  if (!action) {
    return { module: "System", label: "Unknown action" };
  }
  return (
    ACTION_META[action] || {
      module: "System",
      label: String(action)
        .replace(/[_.-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim(),
    }
  );
};

const buildDescription = (action, details = null, fallback = null) => {
  if (fallback) return fallback;

  const meta = getActionMeta(action);
  if (!details || typeof details !== "object") return meta.label;

  if (details.description && typeof details.description === "string") {
    return details.description;
  }

  switch (action) {
    case "case_assigned":
      return details.caseNumber
        ? `Case #${details.caseNumber} was assigned${
            details.officerName ? ` to ${details.officerName}` : ""
          }.`
        : meta.label;
    case "case_created":
      return details.caseNumber
        ? `Case #${details.caseNumber} was created.`
        : meta.label;
    case "case_resolved":
    case "case_status_changed":
      return details.caseNumber
        ? `Case #${details.caseNumber} status changed${
            details.from && details.to ? ` from ${details.from} to ${details.to}` : ""
          }.`
        : meta.label;
    case "user_created":
      return details.targetName
        ? `User "${details.targetName}" was created${
            details.targetRole ? ` (${details.targetRole})` : ""
          }.`
        : meta.label;
    case "user_updated":
      return details.targetName
        ? `User "${details.targetName}" was updated.`
        : meta.label;
    case "user_deleted":
      return details.targetName
        ? `User "${details.targetName}" was deleted.`
        : meta.label;
    case "password_reset":
      return details.targetName
        ? `Password was reset for "${details.targetName}".`
        : meta.label;
    case "role_changed":
      return details.targetName
        ? `Role for "${details.targetName}" changed${
            details.from && details.to ? ` from ${details.from} to ${details.to}` : ""
          }.`
        : meta.label;
    case "blacklist_entry_added":
      return details.name
        ? `Blacklist entry "${details.name}" (${details.type || "item"}) was added.`
        : meta.label;
    case "blacklist_entry_updated":
      return details.name
        ? `Blacklist entry "${details.name}" was updated.`
        : meta.label;
    case "blacklist_entry_removed":
      return details.name
        ? `Blacklist entry "${details.name}" was removed.`
        : meta.label;
    case "login_failed":
      return details.email
        ? `Failed login attempt for ${details.email}.`
        : meta.label;
    case "report_flagged":
      return details.flagLabel
        ? `Report flagged as ${details.flagLabel}${
            details.reportingUserEmail ? ` (${details.reportingUserEmail})` : ""
          }.`
        : meta.label;
    case "report_flag_confirmed":
      return details.account_status
        ? `False-report flag confirmed; account set to ${details.account_status}.`
        : meta.label;
    case "report_flag_rejected":
      return "False-report flag rejected by admin.";
    case "account_sanctioned":
      return details.account_status
        ? `Account sanctioned: ${details.account_status}.`
        : meta.label;
    case "report_generated":
      return details.reportType
        ? `Report generated: ${details.reportType}.`
        : meta.label;
    case "report_exported":
      return details.format
        ? `Report exported as ${String(details.format).toUpperCase()}${
            details.reportType ? ` (${details.reportType})` : ""
          }.`
        : meta.label;
    default:
      return meta.label;
  }
};

module.exports = {
  ACTION_META,
  MODULES,
  SUPERVISOR_MODULES,
  getActionMeta,
  buildDescription,
};
