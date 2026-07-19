const express = require("express");
const router = express.Router();
const { protect, investigatorOrAdmin, adminOnly } = require("../middleware/authMiddleware");
const {
  individualReport,
  generalReport,
  monthlyReport,
  weeklyReport,
  investigatorActivityReport,
  myInvestigatorActivityReport,
  fakeCrimesReport,
} = require("../controllers/reportController");

// All report endpoints require login + investigator or admin role
router.use(protect, investigatorOrAdmin);

router.get("/fake-crimes", fakeCrimesReport); // GET /api/reports/fake-crimes?threshold=&blacklistId=
router.get("/individual", individualReport); // GET /api/reports/individual?blacklistId=...
router.get("/general", generalReport);     // GET /api/reports/general
router.get("/monthly", monthlyReport);     // GET /api/reports/monthly?year=&month=
router.get("/weekly", weeklyReport);       // GET /api/reports/weekly
router.get("/my-activity", myInvestigatorActivityReport); // GET /api/reports/my-activity?from=&to= (investigator only)
router.get("/investigator-activity", adminOnly, investigatorActivityReport); // GET /api/reports/investigator-activity?from=&to= (admin only)

module.exports = router;
