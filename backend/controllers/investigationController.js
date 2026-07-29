const History = require("../model/History");
const BlacklistAlert = require("../model/BlacklistAlert");
const InvestigationCase = require("../model/InvestigationCase");
const Notification = require("../model/Notification");
const User = require("../model/user");
const { sendCaseAssignmentEmail } = require("../services/emailService");
const { sendCaseAssignmentSms } = require("../services/twilioSmsService");
const { migrateResolvedCases } = require("../utils/migrateResolvedCases");
const { logActivity } = require("../utils/activityLogger");
const {
  clearCaseAvailableQueue,
  acceptCaseByInvestigator,
} = require("../services/crimeDetectionService");
const { syncAutoInvestigationReport } = require("../utils/autoInvestigationReport");
const {
  FLAG_STATUSES,
  ACCOUNT_STATUSES,
  suggestAccountStatus,
  FLAG_TYPE_LABELS,
} = require("../utils/reportFlagPolicy");

const populateCase = (query) =>
  query
    .populate({
      path: "history",
      populate: [
        {
          path: "blacklistMatches.item",
          options: { strictPopulate: false },
        },
        {
          path: "user",
          select:
            "name email role false_report_count is_flagged flag_reason flagged_at account_status",
        },
      ],
    })
    .populate("assignedOfficer", "name email role badgeNumber station phone phoneVerified emailAlerts pushNotifications specializations")
    .populate("resolvedBy", "name email role badgeNumber")
    .populate("notes.officer", "name email role")
    .populate("reportFlag.flaggedBy", "name email role")
    .populate("reportFlag.reviewedBy", "name email role")
    .populate(
      "reportFlag.reportingUser",
      "name email role false_report_count is_flagged account_status"
    );

const normalizeAlertText = (text = "") =>
  String(text)
    .toLowerCase()
    .replace(/all reactions:.*$/i, "")
    .replace(/like comment view more comments.*$/i, "")
    .replace(/\b\d+\s*(m|min|h|hr|hrs|d|day|days)\b/g, "")
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();

const normalizeFinalDecision = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value;

  const normalized = String(value).trim().toLowerCase();
  if (["crime", "crime-related", "true", "yes"].includes(normalized)) return true;
  if (
    ["not_crime", "not-crime", "not crime", "not crime-related", "false", "no"].includes(
      normalized
    )
  ) {
    return false;
  }

  return null;
};

const CASE_CATEGORIES = [
  "murder",
  "robbery",
  "terrorism",
  "sexual_assault",
  "financial_fraud",
  "drug_crimes",
  "cybercrime",
  "general",
];

const CATEGORY_KEYWORDS = {
  murder: ["dil", "diley", "dilay", "laayay", "toogasho", "murder", "killing"],
  robbery: ["dhac", "xatooyo", "boob", "lacag", "robbery", "theft"],
  terrorism: ["argagixiso", "qarax", "al-shabaab", "terror", "bomb"],
  sexual_assault: ["kufsi", "faraxumeyn", "sexual", "rape"],
  financial_fraud: ["fraud", "scam", "lacag", "khiyaano", "maaliyad"],
  drug_crimes: ["daroogo", "maandooriye", "drug", "narcotic"],
  cybercrime: ["cyber", "hack", "hacking", "online", "computer", "kumbiyuutar"],
};

const normalizeCategory = (category) =>
  CASE_CATEGORIES.includes(category) ? category : "general";

// Statuses that count as a resolved/closed decision on a case
const RESOLVED_STATUSES = [
  "crime_case",
  "not_crime",
  "false_report",
  "misleading_information",
  "malicious_report",
  "resolved",
];
const isResolvedStatus = (status) => RESOLVED_STATUSES.includes(status);
const isFlagStatus = (status) => FLAG_STATUSES.includes(status);

const inferCaseCategory = (history = {}) => {
  const text = [
    history.content,
    history.matchedKeyword,
    history.prediction,
    ...(history.blacklistMatches || []).map((match) => `${match.type} ${match.value}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      return category;
    }
  }

  return "general";
};

const applyHistoryDecision = async (historyId, isCrime, existingHistory = null) => {
  if (typeof isCrime !== "boolean") return null;

  return History.findByIdAndUpdate(
    historyId,
    {
      isCrime,
      prediction: isCrime ? "CRIME-RELATED" : "not crime-related",
      matchedKeyword: isCrime ? existingHistory?.matchedKeyword : null,
      investigationStatus: isCrime ? "crime_case" : "not_crime",
    },
    { new: true }
  );
};

const markHistorySentToInvestigation = (historyId) =>
  History.findByIdAndUpdate(historyId, {
    investigationStatus: "sent_to_investigation",
  });

const getCrimeAlerts = async (req, res) => {
  try {
    const cases = await InvestigationCase.find().select("history");
    const caseHistoryIds = cases.map((item) => item.history.toString());

    const alerts = await History.find({
      _id: { $nin: caseHistoryIds },
      investigationStatus: { $nin: ["sent_to_investigation", "crime_case", "not_crime"] },
    })
      .populate({
        path: "blacklistMatches.item",
        options: { strictPopulate: false },
      })
      .sort({ createdAt: -1 });

    const seen = new Set();

    const uniqueAlerts = alerts.filter((alert) => {
      const key = alert.postId || normalizeAlertText(alert.content);

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });

    res.json(uniqueAlerts);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch investigation records",
      error: error.message,
    });
  }
};
const getCases = async (req, res) => {
  try {
    await migrateResolvedCases();

    const filter = {};

    if (req.query.status && req.query.status !== "all") {
      filter.status = req.query.status;
    }

    if (req.user.role === "investigator") {
      // Own cases + unassigned pending pool (first to open claims)
      filter.$or = [
        { assignedOfficer: req.user._id },
        { assignedOfficer: null, status: "pending" },
      ];
    }

    const cases = await populateCase(
      InvestigationCase.find(filter).sort({ createdAt: -1 })
    );

    res.json(cases);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch investigation cases",
      error: error.message,
    });
  }
};

const createCaseFromAlert = async (req, res) => {
  try {
    const { historyId, finalDecision, note, category, assignedOfficer } = req.body;

    const history = await History.findById(historyId);
    if (!history) {
      return res.status(404).json({ message: "Record not found" });
    }

    const normalizedDecision = normalizeFinalDecision(finalDecision);
    const normalizedCategory = normalizeCategory(category || inferCaseCategory(history));

    const existingCase = await InvestigationCase.findOne({ history: historyId });
    if (existingCase) {
      const oldOfficerId = existingCase.assignedOfficer?.toString();
      const previousStatus = existingCase.status;
      const wasResolved = isResolvedStatus(previousStatus);

      existingCase.category = normalizedCategory;

      if (assignedOfficer !== undefined) {
        if (req.user.role !== "admin") {
          return res.status(403).json({ message: "Admin only can assign officers" });
        }

        if (assignedOfficer) {
          const officer = await User.findById(assignedOfficer);

          if (!officer || officer.role !== "investigator") {
            return res.status(400).json({ message: "Assigned officer must be an investigator" });
          }

          existingCase.assignedOfficer = assignedOfficer;
          existingCase.status = "investigating";
          if (assignedOfficer.toString() !== oldOfficerId) {
            existingCase.assignedAt = new Date();
          }
          await History.findByIdAndUpdate(historyId, {
            investigationStatus: "under_review",
          });
        } else {
          existingCase.assignedOfficer = null;
          existingCase.assignedAt = null;
        }
      }

      if (note?.trim()) {
        existingCase.notes.push({
          text: note.trim(),
          officer: req.user._id,
        });
      }

      if (typeof normalizedDecision === "boolean") {
        existingCase.status = normalizedDecision ? "crime_case" : "not_crime";
        if (!wasResolved || !existingCase.resolvedAt) {
          existingCase.resolvedAt = new Date();
          existingCase.resolvedBy = req.user._id;
        }
        await applyHistoryDecision(historyId, normalizedDecision, history);
      } else if (!assignedOfficer && existingCase.status !== "investigating") {
        await markHistorySentToInvestigation(historyId);
      }

      await existingCase.save();

      await BlacklistAlert.updateMany(
        { history: historyId },
        { status: "sent_to_investigation" }
      );

      const populatedExisting = await populateCase(
        InvestigationCase.findById(existingCase._id)
      );

      const newOfficerId = populatedExisting.assignedOfficer?._id?.toString();

      if (req.user.role === "admin" && newOfficerId && newOfficerId !== oldOfficerId) {
        await notifyCaseAssignment({
          officerId: newOfficerId,
          investigationCase: populatedExisting,
        });
      }

      if (newOfficerId && newOfficerId !== oldOfficerId) {
        await logActivity({
          req,
          action: "case_assigned",
          resourceType: "InvestigationCase",
          resourceId: existingCase._id,
          details: {
            caseNumber: String(existingCase._id).slice(-6).toUpperCase(),
            assignedOfficer: newOfficerId,
            officerName: populatedExisting.assignedOfficer?.name || null,
          },
        });
      }

      if (typeof normalizedDecision === "boolean" && !wasResolved) {
        await logActivity({
          req,
          action: "case_resolved",
          resourceType: "InvestigationCase",
          resourceId: existingCase._id,
          details: {
            caseNumber: String(existingCase._id).slice(-6).toUpperCase(),
            from: previousStatus,
            to: existingCase.status,
          },
        });
      }

      if (note?.trim()) {
        await logActivity({
          req,
          action: "case_note_added",
          resourceType: "InvestigationCase",
          resourceId: existingCase._id,
        });
      }

      return res.status(200).json({
        message: "Case already exists for this record",
        case: populatedExisting,
      });
    }

    const casePayload = {
      history: historyId,
      category: normalizedCategory,
    };

    if (assignedOfficer !== undefined) {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin only can assign officers" });
      }

      if (assignedOfficer) {
        const officer = await User.findById(assignedOfficer);

        if (!officer || officer.role !== "investigator") {
          return res.status(400).json({ message: "Assigned officer must be an investigator" });
        }

        casePayload.assignedOfficer = assignedOfficer;
        casePayload.status = "investigating";
        casePayload.assignedAt = new Date();
      }
    }

    if (note?.trim()) {
      casePayload.notes = [
        {
          text: note.trim(),
          officer: req.user._id,
        },
      ];
    }

    if (typeof normalizedDecision === "boolean") {
      casePayload.status = normalizedDecision ? "crime_case" : "not_crime";
      casePayload.resolvedAt = new Date();
      casePayload.resolvedBy = req.user._id;
      await applyHistoryDecision(historyId, normalizedDecision, history);
    } else if (casePayload.assignedOfficer) {
      await History.findByIdAndUpdate(historyId, {
        investigationStatus: "under_review",
      });
    } else {
      await markHistorySentToInvestigation(historyId);
    }

    const investigationCase = await InvestigationCase.create(casePayload);

    await BlacklistAlert.updateMany(
      { history: historyId },
      { status: "sent_to_investigation" }
    );

    const populated = await populateCase(
      InvestigationCase.findById(investigationCase._id)
    );

    const assignedOfficerId = populated.assignedOfficer?._id?.toString();

    if (req.user.role === "admin" && assignedOfficerId) {
      await notifyCaseAssignment({
        officerId: assignedOfficerId,
        investigationCase: populated,
      });
    }

    await logActivity({
      req,
      action: "case_created",
      resourceType: "InvestigationCase",
      resourceId: investigationCase._id,
      details: {
        caseNumber: String(investigationCase._id).slice(-6).toUpperCase(),
        category: normalizedCategory,
        status: investigationCase.status,
        assignedOfficer: assignedOfficerId || null,
      },
    });

    if (assignedOfficerId) {
      await logActivity({
        req,
        action: "case_assigned",
        resourceType: "InvestigationCase",
        resourceId: investigationCase._id,
        details: {
          caseNumber: String(investigationCase._id).slice(-6).toUpperCase(),
          assignedOfficer: assignedOfficerId,
          officerName: populated.assignedOfficer?.name || null,
        },
      });
    }

    res.status(201).json({
      message: "Case created successfully",
      case: populated,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create investigation case",
      error: error.message,
    });
  }
};

const sendCaseAssignmentEmailAlert = async ({ officer, investigationCase }) => {
  try {
    if (!officer?.email || officer.emailAlerts === false) return;

    await sendCaseAssignmentEmail({
      to: officer.email,
      officer,
      investigationCase,
    });
  } catch (error) {
    console.error("CASE ASSIGNMENT EMAIL ERROR:", error.message);
  }
};

const sendCaseAssignmentSmsAlert = async ({ officer, investigationCase }) => {
  try {
    await sendCaseAssignmentSms({ officer, investigationCase });
  } catch (error) {
    console.error("CASE ASSIGNMENT SMS ERROR:", error.message);
  }
};

const notifyCaseAssignment = async ({ officerId, investigationCase }) => {
  if (!officerId || !investigationCase?._id) return;

  await clearCaseAvailableQueue(investigationCase._id, officerId);

  await Notification.create({
    recipient: officerId,
    case: investigationCase._id,
    type: "case_assigned",
    title: "Investigation case assigned",
    message: `A new ${investigationCase.category || "general"} case has been assigned to you for investigation.`,
    active: true,
    read: false,
  });

  await sendCaseAssignmentEmailAlert({
    officer: investigationCase.assignedOfficer,
    investigationCase,
  });

  await sendCaseAssignmentSmsAlert({
    officer: investigationCase.assignedOfficer,
    investigationCase,
  });
};

const acceptCase = async (req, res) => {
  try {
    if (req.user.role !== "investigator" && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only investigators can claim cases" });
    }

    // Admins may still force-assign via PATCH; accept is for investigator claim-on-open
    if (req.user.role === "admin") {
      return res.status(403).json({
        message: "Admins assign investigators from Case Management. Investigators claim by opening the case.",
      });
    }

    const result = await acceptCaseByInvestigator({
      caseId: req.params.id,
      investigator: req.user,
    });

    const populated = await populateCase(
      InvestigationCase.findById(result.case._id)
    );

    if (!result.alreadyMine) {
      await logActivity({
        req,
        action: "case_claimed",
        resourceType: "InvestigationCase",
        resourceId: result.case._id,
        details: { status: result.case.status },
      });
    }

    return res.json({
      message: result.alreadyMine
        ? "You already have this case"
        : "Case claimed successfully. Other investigators were removed from the queue.",
      case: populated,
      alreadyMine: result.alreadyMine,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      message: error.message || "Failed to claim case",
      assignedOfficer: error.assignedOfficer || null,
    });
  }
};

const updateCase = async (req, res) => {
  try {
    const { status, assignedOfficer, isCrime, category, findings } = req.body;
    const updates = {};

    const existingCase = await InvestigationCase.findById(req.params.id).populate(
      "history"
    );

    if (!existingCase) {
      return res.status(404).json({ message: "Case not found" });
    }

    const caseIsClosed =
      isResolvedStatus(existingCase.status) ||
      existingCase.status === "archived" ||
      existingCase.archived === true;

    // Closed/resolved cases: no reassignment, no reopen — investigator decision is final
    if (caseIsClosed) {
      if (assignedOfficer !== undefined) {
        return res.status(400).json({
          message:
            "This case is closed. It cannot be reassigned to another investigator.",
        });
      }

      if (status !== undefined || typeof isCrime === "boolean") {
        return res.status(400).json({
          message: "This case is already resolved and closed.",
        });
      }
    }

    if (req.user.role === "investigator") {
      if (!existingCase.assignedOfficer) {
        return res.status(403).json({
          message: "This case is not assigned yet. Wait for an admin to assign an investigator.",
        });
      }

      if (existingCase.assignedOfficer.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "This case is not assigned to you" });
      }
    }

    if (typeof isCrime === "boolean" && !status) {
      updates.status = isCrime ? "crime_case" : "not_crime";
    }

    if (status && status !== "resolved") {
      updates.status = status;
    }

    if (category !== undefined) {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin only can change case category" });
      }

      updates.category = normalizeCategory(category);
    }

    if (findings !== undefined) {
      updates.findings = String(findings || "").trim();
    }

    if (assignedOfficer !== undefined) {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin only can assign officers" });
      }

      if (assignedOfficer) {
        const officer = await User.findById(assignedOfficer);

        if (!officer || officer.role !== "investigator") {
          return res.status(400).json({ message: "Assigned officer must be an investigator" });
        }
      }

      updates.assignedOfficer = assignedOfficer || null;

      if (assignedOfficer && !status) {
        updates.status = "investigating";
      }
    }

    if (status === "archived") updates.archived = true;

    // "Resolved" must land as Crime or Not Crime — never a vague resolved status.
    if (status === "resolved") {
      const resolvedAsCrime =
        typeof isCrime === "boolean"
          ? isCrime
          : existingCase.history?.isCrime === true;
      updates.status = resolvedAsCrime ? "crime_case" : "not_crime";
    }

    const statusDecision =
      updates.status === "crime_case"
        ? true
        : updates.status === "not_crime"
        ? false
        : status === "crime_case"
        ? true
        : status === "not_crime"
        ? false
        : null;

    if (typeof isCrime === "boolean" || typeof statusDecision === "boolean") {
      const finalDecision =
        typeof isCrime === "boolean" ? isCrime : statusDecision;

      if (typeof isCrime === "boolean" && !updates.status) {
        updates.status = finalDecision ? "crime_case" : "not_crime";
      }

      await History.findByIdAndUpdate(existingCase.history._id || existingCase.history, {
        isCrime: finalDecision,
        prediction: finalDecision ? "CRIME-RELATED" : "not crime-related",
        matchedKeyword: finalDecision ? existingCase.history?.matchedKeyword : null,
        investigationStatus: finalDecision ? "crime_case" : "not_crime",
      });
    } else if (status === "investigating" || updates.status === "investigating") {
      await History.findByIdAndUpdate(existingCase.history._id || existingCase.history, {
        investigationStatus: "under_review",
      });
    } else if (status === "archived" || updates.status === "archived") {
      await History.findByIdAndUpdate(existingCase.history._id || existingCase.history, {
        investigationStatus: "closed",
      });
    } else if (assignedOfficer !== undefined) {
      await History.findByIdAndUpdate(existingCase.history._id || existingCase.history, {
        investigationStatus: "under_review",
      });
    } else if (isFlagStatus(updates.status)) {
      await History.findByIdAndUpdate(existingCase.history._id || existingCase.history, {
        investigationStatus: updates.status,
      });
    }

    const oldOfficerId = existingCase.assignedOfficer?.toString();
    const wasResolved = isResolvedStatus(existingCase.status);
    const willBeResolved =
      updates.status !== undefined
        ? isResolvedStatus(updates.status)
        : wasResolved;

    // Track exact resolution/assignment moments for activity reporting
    if (willBeResolved && !wasResolved) {
      updates.resolvedAt = new Date();
      updates.resolvedBy = req.user._id;
      // Auto-close: lock the case so it cannot be claimed or reassigned
      updates.archived = true;
    } else if (wasResolved && ["pending", "investigating"].includes(updates.status)) {
      // Genuine reopen — clear resolution markers (blocked when caseIsClosed)
      updates.resolvedAt = null;
      updates.resolvedBy = null;
    }

    if (updates.assignedOfficer !== undefined) {
      const nextOfficerId = updates.assignedOfficer
        ? updates.assignedOfficer.toString()
        : null;
      if (!nextOfficerId) {
        updates.assignedAt = null;
      } else if (nextOfficerId !== oldOfficerId) {
        updates.assignedAt = new Date();
      }
    }

    // Record when investigation work formally began
    const nextStatus = updates.status || existingCase.status;
    if (
      nextStatus === "investigating" &&
      !existingCase.investigationStartedAt &&
      !updates.investigationStartedAt
    ) {
      updates.investigationStartedAt = new Date();
    }

    const investigationCase = await populateCase(
      InvestigationCase.findByIdAndUpdate(req.params.id, updates, {
        new: true,
        runValidators: true,
      })
    );

    const newOfficerId = investigationCase.assignedOfficer?._id?.toString();

    if (newOfficerId && newOfficerId !== oldOfficerId) {
      await notifyCaseAssignment({
        officerId: newOfficerId,
        investigationCase,
      });

      await logActivity({
        req,
        action: "case_assigned",
        resourceType: "InvestigationCase",
        resourceId: investigationCase._id,
        details: { assignedOfficer: newOfficerId },
      });
    }

    if (Object.keys(updates).length > 0) {
      await logActivity({
        req,
        action: willBeResolved && !wasResolved ? "case_resolved" : "case_updated",
        resourceType: "InvestigationCase",
        resourceId: investigationCase._id,
        details: {
          from: existingCase.status,
          to: investigationCase.status,
          changed: Object.keys(updates),
        },
      });
    }

    // Auto-generate / refresh the investigator's formal report (no manual form)
    const reportOwnerId =
      investigationCase.assignedOfficer?._id ||
      investigationCase.assignedOfficer ||
      (willBeResolved ? req.user._id : null);

    if (reportOwnerId) {
      try {
        await syncAutoInvestigationReport({
          investigationCase,
          investigatorId: reportOwnerId,
          finalize: isResolvedStatus(investigationCase.status),
        });
      } catch (syncError) {
        console.error("Auto investigation report sync failed:", syncError.message);
      }
    }

    res.json({
      message: "Case updated successfully",
      case: investigationCase,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update case",
      error: error.message,
    });
  }
};

const addCaseNote = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Note text is required" });
    }

    const investigationCase = await InvestigationCase.findById(req.params.id);
    if (!investigationCase) {
      return res.status(404).json({ message: "Case not found" });
    }

    if (req.user.role === "investigator") {
      if (!investigationCase.assignedOfficer) {
        return res.status(403).json({
          message: "This case is not assigned yet. Wait for an admin to assign an investigator.",
        });
      }

      if (
        investigationCase.assignedOfficer.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({ message: "This case is not assigned to you" });
      }
    }

    investigationCase.notes.push({
      text: text.trim(),
      officer: req.user._id,
    });

    await investigationCase.save();

    await logActivity({
      req,
      action: "case_note_added",
      resourceType: "InvestigationCase",
      resourceId: investigationCase._id,
    });

    const populated = await populateCase(
      InvestigationCase.findById(investigationCase._id)
    );

    // Keep auto draft report in sync with notes
    const reportOwnerId =
      populated.assignedOfficer?._id || populated.assignedOfficer || req.user._id;
    if (reportOwnerId) {
      try {
        await syncAutoInvestigationReport({
          investigationCase: populated,
          investigatorId: reportOwnerId,
          finalize: isResolvedStatus(populated.status),
        });
      } catch (syncError) {
        console.error("Auto investigation report sync failed:", syncError.message);
      }
    }

    res.json({
      message: "Note added successfully",
      case: populated,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to add note",
      error: error.message,
    });
  }
};

const deleteCase = async (req, res) => {
  try {
    const investigationCase = await InvestigationCase.findByIdAndDelete(req.params.id);

    if (!investigationCase) {
      return res.status(404).json({ message: "Case not found" });
    }

    res.json({ message: "Case deleted successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete case",
      error: error.message,
    });
  }
};

/**
 * Investigator/admin marks a case as False Report (etc.).
 * Flag is applied immediately — increments count and applies policy sanctions
 * (no admin confirmation step).
 */
const flagCase = async (req, res) => {
  try {
    const { flagType, reason } = req.body;
    const normalizedType = String(flagType || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

    if (!FLAG_STATUSES.includes(normalizedType)) {
      return res.status(400).json({
        message:
          "flagType must be false_report, misleading_information, or malicious_report",
      });
    }

    const reasonText = String(reason || "").trim();
    if (reasonText.length < 5) {
      return res.status(400).json({
        message: "A reason of at least 5 characters is required",
      });
    }

    const existingCase = await InvestigationCase.findById(req.params.id).populate(
      "history"
    );

    if (!existingCase) {
      return res.status(404).json({ message: "Case not found" });
    }

    if (req.user.role === "investigator") {
      if (!existingCase.assignedOfficer) {
        return res.status(403).json({
          message:
            "This case is not assigned yet. Wait for an admin to assign an investigator.",
        });
      }
      if (existingCase.assignedOfficer.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "This case is not assigned to you" });
      }
    }

    if (existingCase.reportFlag?.reviewStatus === "pending") {
      return res.status(400).json({
        message: "This case already has a flag pending admin review",
      });
    }

    if (
      existingCase.reportFlag?.reviewStatus === "confirmed" &&
      isFlagStatus(existingCase.status)
    ) {
      return res.status(400).json({
        message: "This case was already flagged",
      });
    }

    const historyDoc = existingCase.history;
    const reportingUserId =
      historyDoc?.user?._id || historyDoc?.user || null;

    let reportingUser = null;
    let appliedStatus = null;

    if (reportingUserId) {
      reportingUser = await User.findById(reportingUserId);
      if (!reportingUser) {
        return res.status(404).json({ message: "Reporting user not found" });
      }

      if (["admin", "investigator"].includes(reportingUser.role)) {
        return res.status(400).json({
          message: "Staff accounts cannot be flagged for false reports",
        });
      }

      const alreadyCounted =
        existingCase.reportFlag?.reviewStatus === "confirmed" ||
        (existingCase.reportFlag?.reviewStatus === "pending" &&
          existingCase.reportFlag?.reportingUser?.toString() ===
            reportingUserId.toString());

      if (!alreadyCounted) {
        reportingUser.false_report_count =
          (reportingUser.false_report_count || 0) + 1;
      }

      reportingUser.is_flagged = true;
      reportingUser.flag_reason = reasonText;
      reportingUser.flagged_by = req.user._id;
      reportingUser.flagged_at = new Date();

      appliedStatus = suggestAccountStatus(reportingUser.false_report_count);
      reportingUser.account_status = appliedStatus;
      if (appliedStatus === "blocked" || appliedStatus === "suspended") {
        reportingUser.status = "inactive";
      }

      await reportingUser.save();
    }

    const wasResolved = isResolvedStatus(existingCase.status);
    const now = new Date();

    existingCase.status = normalizedType;
    existingCase.reportFlag = {
      type: normalizedType,
      reason: reasonText,
      flaggedBy: req.user._id,
      flaggedAt: now,
      reviewStatus: "confirmed",
      reviewedBy: req.user._id,
      reviewedAt: now,
      adminAction: appliedStatus || "none",
      adminNotes: "Auto-applied on investigator flag (policy)",
      reportingUser: reportingUser?._id || null,
    };

    if (!wasResolved) {
      existingCase.resolvedAt = now;
      existingCase.resolvedBy = req.user._id;
    }

    await existingCase.save();

    await History.findByIdAndUpdate(historyDoc._id || historyDoc, {
      isCrime: false,
      prediction: "not crime-related",
      investigationStatus: normalizedType,
    });

    const populated = await populateCase(
      InvestigationCase.findById(existingCase._id)
    );

    await logActivity({
      req,
      action: "report_flagged",
      resourceType: "InvestigationCase",
      resourceId: existingCase._id,
      details: {
        flagType: normalizedType,
        flagLabel: FLAG_TYPE_LABELS[normalizedType],
        reason: reasonText,
        reportingUserId: reportingUser?._id || null,
        reportingUserEmail: reportingUser?.email || null,
        false_report_count: reportingUser?.false_report_count ?? null,
        account_status: appliedStatus,
        autoConfirmed: true,
        caseOnly: !reportingUser,
      },
    });

    if (reportingUser && appliedStatus) {
      await logActivity({
        req,
        action: "account_sanctioned",
        resourceType: "User",
        resourceId: reportingUser._id,
        details: {
          account_status: appliedStatus,
          false_report_count: reportingUser.false_report_count,
          caseId: existingCase._id,
          flagType: normalizedType,
          autoApplied: true,
        },
      });
    }

    return res.json({
      message: reportingUser
        ? `${FLAG_TYPE_LABELS[normalizedType]} applied. Account status set to ${appliedStatus} (flags: ${reportingUser.false_report_count}).`
        : `${FLAG_TYPE_LABELS[normalizedType]} recorded on this case. No linked citizen account to sanction.`,
      case: populated,
      reportingUser: reportingUser
        ? {
            _id: reportingUser._id,
            name: reportingUser.name,
            email: reportingUser.email,
            false_report_count: reportingUser.false_report_count,
            is_flagged: reportingUser.is_flagged,
            account_status: reportingUser.account_status,
          }
        : null,
      appliedAction: appliedStatus,
      suggestedAction: appliedStatus,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to flag report",
      error: error.message,
    });
  }
};

/**
 * Admin confirms or rejects an investigator flag, then may apply sanctions.
 */
const reviewCaseFlag = async (req, res) => {
  try {
    const { decision, adminAction, adminNotes } = req.body;
    const normalizedDecision = String(decision || "")
      .trim()
      .toLowerCase();

    if (!["confirm", "reject"].includes(normalizedDecision)) {
      return res.status(400).json({
        message: 'decision must be "confirm" or "reject"',
      });
    }

    const existingCase = await InvestigationCase.findById(req.params.id).populate(
      "history"
    );

    if (!existingCase) {
      return res.status(404).json({ message: "Case not found" });
    }

    if (!existingCase.reportFlag?.reviewStatus) {
      return res.status(400).json({
        message: "This case has no report flag to review",
      });
    }

    if (existingCase.reportFlag.reviewStatus !== "pending") {
      return res.status(400).json({
        message: `Flag was already ${existingCase.reportFlag.reviewStatus}`,
      });
    }

    const reportingUserId =
      existingCase.reportFlag.reportingUser ||
      existingCase.history?.user?._id ||
      existingCase.history?.user;

    const reportingUser = reportingUserId
      ? await User.findById(reportingUserId)
      : null;

    if (normalizedDecision === "reject") {
      existingCase.reportFlag.reviewStatus = "rejected";
      existingCase.reportFlag.reviewedBy = req.user._id;
      existingCase.reportFlag.reviewedAt = new Date();
      existingCase.reportFlag.adminAction = "none";
      existingCase.reportFlag.adminNotes = String(adminNotes || "").trim();

      if (reportingUser) {
        reportingUser.false_report_count = Math.max(
          0,
          (reportingUser.false_report_count || 0) - 1
        );
        if (reportingUser.false_report_count === 0) {
          reportingUser.is_flagged = false;
          reportingUser.flag_reason = null;
          reportingUser.flagged_by = null;
          reportingUser.flagged_at = null;
        }
        await reportingUser.save();
      }

      await existingCase.save();

      const populated = await populateCase(
        InvestigationCase.findById(existingCase._id)
      );

      await logActivity({
        req,
        action: "report_flag_rejected",
        resourceType: "InvestigationCase",
        resourceId: existingCase._id,
        details: {
          reportingUserId: reportingUser?._id,
          false_report_count: reportingUser?.false_report_count,
        },
      });

      return res.json({
        message: "Flag rejected. Reporting user flag count was rolled back.",
        case: populated,
        reportingUser,
      });
    }

    // Confirm
    let appliedStatus = null;
    const suggested = reportingUser
      ? suggestAccountStatus(reportingUser.false_report_count)
      : "active";

    if (adminAction !== undefined && adminAction !== null && adminAction !== "") {
      const normalizedAction = String(adminAction).trim().toLowerCase();
      if (!ACCOUNT_STATUSES.includes(normalizedAction) && normalizedAction !== "none") {
        return res.status(400).json({
          message: `adminAction must be one of: none, ${ACCOUNT_STATUSES.join(", ")}`,
        });
      }
      appliedStatus = normalizedAction === "none" ? null : normalizedAction;
    } else {
      appliedStatus = suggested;
    }

    existingCase.reportFlag.reviewStatus = "confirmed";
    existingCase.reportFlag.reviewedBy = req.user._id;
    existingCase.reportFlag.reviewedAt = new Date();
    existingCase.reportFlag.adminAction = appliedStatus || "none";
    existingCase.reportFlag.adminNotes = String(adminNotes || "").trim();
    await existingCase.save();

    if (reportingUser && appliedStatus) {
      reportingUser.account_status = appliedStatus;
      reportingUser.is_flagged = true;
      if (appliedStatus === "blocked" || appliedStatus === "suspended") {
        reportingUser.status = "inactive";
      }
      await reportingUser.save();

      await logActivity({
        req,
        action: "account_sanctioned",
        resourceType: "User",
        resourceId: reportingUser._id,
        details: {
          account_status: appliedStatus,
          false_report_count: reportingUser.false_report_count,
          caseId: existingCase._id,
          flagType: existingCase.reportFlag.type,
        },
      });
    }

    const populated = await populateCase(
      InvestigationCase.findById(existingCase._id)
    );

    await logActivity({
      req,
      action: "report_flag_confirmed",
      resourceType: "InvestigationCase",
      resourceId: existingCase._id,
      details: {
        reportingUserId: reportingUser?._id,
        account_status: appliedStatus,
        false_report_count: reportingUser?.false_report_count,
        flagType: existingCase.reportFlag.type,
      },
    });

    return res.json({
      message: appliedStatus
        ? `Flag confirmed. Account status set to ${appliedStatus}.`
        : "Flag confirmed. No account status change applied.",
      case: populated,
      reportingUser,
      suggestedAction: suggested,
      appliedAction: appliedStatus,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to review report flag",
      error: error.message,
    });
  }
};

const getInvestigators = async (req, res) => {
  try {
    const officers = await User.find({ role: "investigator" })
      .select("name email badgeNumber station role emailAlerts specializations")
      .sort({ name: 1 });

    res.json(officers);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch investigators",
      error: error.message,
    });
  }
};

module.exports = {
  getCrimeAlerts,
  getCases,
  createCaseFromAlert,
  updateCase,
  addCaseNote,
  deleteCase,
  getInvestigators,
  acceptCase,
  flagCase,
  reviewCaseFlag,
};
