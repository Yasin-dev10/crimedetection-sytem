const mongoose = require("mongoose");
const InvestigationReport = require("../model/InvestigationReport");
const InvestigationCase = require("../model/InvestigationCase");
const { logActivity } = require("../utils/activityLogger");

const CLOSED_CASE_STATUSES = new Set(["crime_case", "not_crime", "resolved", "archived"]);

const populateReport = (query) =>
  query
    .populate({
      path: "case",
      populate: [
        {
          path: "history",
          populate: {
            path: "blacklistMatches.item",
            options: { strictPopulate: false },
          },
        },
        { path: "assignedOfficer", select: "name email role badgeNumber station" },
        { path: "resolvedBy", select: "name email role badgeNumber" },
        { path: "notes.officer", select: "name email role" },
      ],
    })
    .populate("investigator", "name email role badgeNumber station");

const isAdmin = (user) => user?.role === "admin";
const isInvestigator = (user) => user?.role === "investigator";

const getUserId = (user) => String(user?._id || user?.id || "");

const formatReport = (doc) => {
  if (!doc) return null;
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    ...plain,
    id: plain._id?.toString(),
  };
};

const assertCanAccessReport = (report, user) => {
  if (isAdmin(user)) return true;
  if (isInvestigator(user) && String(report.investigator?._id || report.investigator) === getUserId(user)) {
    return true;
  }
  return false;
};

const caseIsClosed = (investigationCase) =>
  CLOSED_CASE_STATUSES.has(investigationCase?.status);

/**
 * GET /api/investigation/reports
 * Admin: all reports. Investigator: own reports only.
 */
const listReports = async (req, res) => {
  try {
    const filter = {};

    if (isInvestigator(req.user) && !isAdmin(req.user)) {
      filter.investigator = req.user._id;
    } else if (req.query.investigatorId && isAdmin(req.user)) {
      filter.investigator = req.query.investigatorId;
    }

    if (req.query.caseId) {
      filter.case = req.query.caseId;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }

    const reports = await populateReport(
      InvestigationReport.find(filter).sort({ updatedAt: -1 })
    );

    res.json(reports.map(formatReport));
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch investigation reports",
      error: error.message,
    });
  }
};

/**
 * GET /api/investigation/reports/:id
 */
const getReportById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid report ID" });
    }

    const report = await populateReport(InvestigationReport.findById(req.params.id));
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    if (!assertCanAccessReport(report, req.user)) {
      return res.status(403).json({
        message: "You can only view your own investigation reports",
      });
    }

    res.json(formatReport(report));
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch investigation report",
      error: error.message,
    });
  }
};

/**
 * GET /api/investigation/cases/:caseId/reports
 * Scoped list for a single case.
 * Also auto-syncs the assigned investigator's report so the UI always has one.
 */
const listReportsForCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(caseId)) {
      return res.status(400).json({ message: "Invalid case ID" });
    }

    const investigationCase = await InvestigationCase.findById(caseId)
      .populate("history")
      .populate("notes.officer", "name email role")
      .populate("assignedOfficer", "name email role badgeNumber");

    if (!investigationCase) {
      return res.status(404).json({ message: "Case not found" });
    }

    const ownerId =
      investigationCase.assignedOfficer?._id || investigationCase.assignedOfficer;

    // Auto-create/refresh report whenever case details are opened
    if (ownerId) {
      try {
        const { syncAutoInvestigationReport } = require("../utils/autoInvestigationReport");
        const closed = ["crime_case", "not_crime", "resolved", "archived"].includes(
          investigationCase.status
        );
        await syncAutoInvestigationReport({
          investigationCase,
          investigatorId: ownerId,
          finalize: closed,
        });
      } catch (syncError) {
        console.error("Auto investigation report sync failed:", syncError.message);
      }
    }

    const filter = { case: caseId };
    if (isInvestigator(req.user) && !isAdmin(req.user)) {
      filter.investigator = req.user._id;
    }

    const reports = await populateReport(
      InvestigationReport.find(filter).sort({ updatedAt: -1 })
    );

    res.json(reports.map(formatReport));
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch case reports",
      error: error.message,
    });
  }
};

/**
 * POST /api/investigation/reports
 * Body: { caseId, title, findings, recommendation, status }
 */
const createReport = async (req, res) => {
  try {
    const { caseId, title, findings, recommendation, status } = req.body;

    if (!caseId || !mongoose.Types.ObjectId.isValid(caseId)) {
      return res.status(400).json({ message: "Valid caseId is required" });
    }

    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: "Report title is required" });
    }

    const investigationCase = await InvestigationCase.findById(caseId);
    if (!investigationCase) {
      return res.status(404).json({ message: "Case not found" });
    }

    // Investigator must be assigned to the case (admin may create on behalf)
    let ownerId = req.user._id;
    if (isInvestigator(req.user) && !isAdmin(req.user)) {
      if (
        !investigationCase.assignedOfficer ||
        String(investigationCase.assignedOfficer) !== getUserId(req.user)
      ) {
        return res.status(403).json({
          message: "You can only create a report for a case assigned to you",
        });
      }
    } else if (isAdmin(req.user) && req.body.investigatorId) {
      ownerId = req.body.investigatorId;
    } else if (isAdmin(req.user) && investigationCase.assignedOfficer) {
      ownerId = investigationCase.assignedOfficer;
    }

    const existing = await InvestigationReport.findOne({
      case: caseId,
      investigator: ownerId,
    });
    if (existing) {
      return res.status(409).json({
        message: "A report already exists for this investigator on this case",
        report: formatReport(
          await populateReport(InvestigationReport.findById(existing._id))
        ),
      });
    }

    const report = await InvestigationReport.create({
      case: caseId,
      investigator: ownerId,
      title: String(title).trim(),
      findings: String(findings || "").trim(),
      recommendation: String(recommendation || "").trim(),
      status: ["draft", "submitted", "finalized"].includes(status)
        ? status
        : "draft",
    });

    const populated = await populateReport(
      InvestigationReport.findById(report._id)
    );

    await logActivity({
      req,
      action: "investigation_report_created",
      resourceType: "InvestigationReport",
      resourceId: report._id,
      details: {
        caseId,
        title: report.title,
        status: report.status,
      },
    });

    res.status(201).json({
      message: "Investigation report created",
      report: formatReport(populated),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "A report already exists for this investigator on this case",
      });
    }
    res.status(500).json({
      message: "Failed to create investigation report",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/investigation/reports/:id
 * Investigator: edit own report only if case is not closed.
 * Admin: edit any report.
 */
const updateReport = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid report ID" });
    }

    const report = await InvestigationReport.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    const investigationCase = await InvestigationCase.findById(report.case);
    if (!investigationCase) {
      return res.status(404).json({ message: "Linked case not found" });
    }

    const ownsReport = String(report.investigator) === getUserId(req.user);

    if (!isAdmin(req.user)) {
      if (!ownsReport) {
        return res.status(403).json({
          message: "You can only edit your own investigation reports",
        });
      }
      if (caseIsClosed(investigationCase)) {
        return res.status(403).json({
          message: "This case is closed — the report can no longer be edited",
        });
      }
    }

    const { title, findings, recommendation, status } = req.body;
    if (title !== undefined) {
      if (!String(title).trim()) {
        return res.status(400).json({ message: "Report title cannot be empty" });
      }
      report.title = String(title).trim();
    }
    if (findings !== undefined) report.findings = String(findings || "").trim();
    if (recommendation !== undefined) {
      report.recommendation = String(recommendation || "").trim();
    }
    if (status !== undefined) {
      if (!["draft", "submitted", "finalized"].includes(status)) {
        return res.status(400).json({ message: "Invalid report status" });
      }
      report.status = status;
    }

    await report.save();

    const populated = await populateReport(
      InvestigationReport.findById(report._id)
    );

    await logActivity({
      req,
      action: "investigation_report_updated",
      resourceType: "InvestigationReport",
      resourceId: report._id,
      details: {
        caseId: String(report.case),
        title: report.title,
        status: report.status,
      },
    });

    res.json({
      message: "Investigation report updated",
      report: formatReport(populated),
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update investigation report",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/investigation/reports/:id
 * Admin only.
 */
const deleteReport = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        message: "Only admins can delete investigation reports",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid report ID" });
    }

    const report = await InvestigationReport.findByIdAndDelete(req.params.id);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    await logActivity({
      req,
      action: "investigation_report_deleted",
      resourceType: "InvestigationReport",
      resourceId: report._id,
      details: {
        caseId: String(report.case),
        title: report.title,
        investigatorId: String(report.investigator),
      },
    });

    res.json({ message: "Investigation report deleted" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete investigation report",
      error: error.message,
    });
  }
};

module.exports = {
  listReports,
  getReportById,
  listReportsForCase,
  createReport,
  updateReport,
  deleteReport,
};
