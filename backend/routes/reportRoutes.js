const express = require("express");
const router = express.Router();
const { protect, investigatorOrAdmin, adminOnly } = require("../middleware/authMiddleware");
const {
  individualReport,
  generalReport,
  monthlyReport,
  weeklyReport,
  crimeCasesReport,
  investigatorActivityReport,
  myInvestigatorActivityReport,
  myWorkReport,
  fakeCrimesReport,
} = require("../controllers/reportController");

// All report endpoints require login + investigator or admin role
router.use(protect, investigatorOrAdmin);

// System-wide aggregate reports — Admin only
router.get("/fake-crimes", adminOnly, fakeCrimesReport);
router.get("/individual", adminOnly, individualReport);
router.get("/general", adminOnly, generalReport);
router.get("/monthly", adminOnly, monthlyReport);
router.get("/weekly", adminOnly, weeklyReport);
router.get("/crime-cases", adminOnly, crimeCasesReport);

// Investigator: own work only
router.get("/my-work", myWorkReport);
router.get("/my-activity", myInvestigatorActivityReport);
router.get("/investigator-activity", adminOnly, investigatorActivityReport);

module.exports = router;
