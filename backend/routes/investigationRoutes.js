const express = require("express");
const {
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
} = require("../controllers/investigationController");
const {
  listReports,
  getReportById,
  listReportsForCase,
  createReport,
  updateReport,
  deleteReport,
} = require("../controllers/investigationReportController");
const { protect, investigatorOrAdmin, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/alerts", protect, investigatorOrAdmin, getCrimeAlerts);
router.get("/cases", protect, investigatorOrAdmin, getCases);
router.post("/cases", protect, investigatorOrAdmin, createCaseFromAlert);
router.post("/cases/:id/accept", protect, investigatorOrAdmin, acceptCase);
router.patch("/cases/:id", protect, investigatorOrAdmin, updateCase);
router.post("/cases/:id/flag", protect, investigatorOrAdmin, flagCase);
router.post("/cases/:id/flag/review", protect, adminOnly, reviewCaseFlag);
router.post("/cases/:id/notes", protect, investigatorOrAdmin, addCaseNote);
router.delete("/cases/:id", protect, adminOnly, deleteCase);
router.get("/officers", protect, adminOnly, getInvestigators);

// Investigation reports (ownership-scoped)
router.get("/reports", protect, investigatorOrAdmin, listReports);
router.post("/reports", protect, investigatorOrAdmin, createReport);
router.get("/reports/:id", protect, investigatorOrAdmin, getReportById);
router.patch("/reports/:id", protect, investigatorOrAdmin, updateReport);
router.delete("/reports/:id", protect, adminOnly, deleteReport);
router.get("/cases/:caseId/reports", protect, investigatorOrAdmin, listReportsForCase);

module.exports = router;
