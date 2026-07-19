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
} = require("../controllers/investigationController");
const { protect, investigatorOrAdmin, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/alerts", protect, investigatorOrAdmin, getCrimeAlerts);
router.get("/cases", protect, investigatorOrAdmin, getCases);
router.post("/cases", protect, investigatorOrAdmin, createCaseFromAlert);
router.post("/cases/:id/accept", protect, investigatorOrAdmin, acceptCase);
router.patch("/cases/:id", protect, investigatorOrAdmin, updateCase);
router.post("/cases/:id/notes", protect, investigatorOrAdmin, addCaseNote);
router.delete("/cases/:id", protect, adminOnly, deleteCase);
router.get("/officers", protect, adminOnly, getInvestigators);

module.exports = router;
