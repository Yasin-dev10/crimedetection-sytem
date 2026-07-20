const express = require("express");
const router = express.Router();
const { protect, investigatorOrAdmin } = require("../middleware/authMiddleware");
const {
  getAuditLogs,
  getAuditLogMeta,
  getAuditLogStats,
} = require("../controllers/auditLogController");

router.use(protect, investigatorOrAdmin);

router.get("/meta", getAuditLogMeta);
router.get("/stats", getAuditLogStats);
router.get("/", getAuditLogs);
router.post("/events", async (req, res) => {
  try {
    const { logActivity } = require("../utils/activityLogger");
    const { action, details, status } = req.body || {};

    if (!["report_exported"].includes(action)) {
      return res.status(400).json({ message: "Unsupported audit event" });
    }

    await logActivity({
      req,
      action,
      status: status === "failed" ? "failed" : "success",
      details: details || null,
    });

    res.status(201).json({ message: "Audit event recorded" });
  } catch (error) {
    res.status(500).json({ message: "Failed to record audit event", error: error.message });
  }
});

module.exports = router;
