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

const populateCase = (query) =>
  query
    .populate({
      path: "history",
      populate: {
        path: "blacklistMatches.item",
        options: { strictPopulate: false },
      },
    })
    .populate("assignedOfficer", "name email role badgeNumber station phone phoneVerified emailAlerts pushNotifications specializations")
    .populate("notes.officer", "name email role");

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
const RESOLVED_STATUSES = ["crime_case", "not_crime", "resolved"];
const isResolvedStatus = (status) => RESOLVED_STATUSES.includes(status);

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
          details: { assignedOfficer: newOfficerId },
        });
      }

      if (typeof normalizedDecision === "boolean" && !wasResolved) {
        await logActivity({
          req,
          action: "case_resolved",
          resourceType: "InvestigationCase",
          resourceId: existingCase._id,
          details: { from: previousStatus, to: existingCase.status },
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
        details: { assignedOfficer: assignedOfficerId },
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
    const { status, assignedOfficer, isCrime, category } = req.body;
    const updates = {};

    const existingCase = await InvestigationCase.findById(req.params.id).populate(
      "history"
    );

    if (!existingCase) {
      return res.status(404).json({ message: "Case not found" });
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
    } else if (wasResolved && ["pending", "investigating"].includes(updates.status)) {
      // Genuine reopen — clear resolution markers (archiving keeps them)
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
};
