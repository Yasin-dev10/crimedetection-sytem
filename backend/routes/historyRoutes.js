const express = require("express");
const router = express.Router();

const History = require("../model/History");
const { protect, investigatorOrAdmin } = require("../middleware/authMiddleware");
const {
  buildDatasetWorkbook,
  buildDatasetCsv,
} = require("../services/datasetStore");

const canViewAllHistory = (user) =>
  user && ["admin", "investigator"].includes(user.role);

// Export collected analysis data as Excel (.xlsx) for dataset study / retraining
// Query: ?source=all|analysis|facebook|website&scope=all|mine&format=xlsx|csv
router.get("/dataset/export", protect, async (req, res) => {
  try {
    const format = String(req.query.format || "xlsx").toLowerCase();
    const source = String(req.query.source || "all").toLowerCase();
    const scope = String(req.query.scope || "all").toLowerCase();

    const mineOnly = scope === "mine" || !canViewAllHistory(req.user);
    const options = {
      source: ["all", "analysis", "facebook", "website"].includes(source)
        ? source
        : "all",
      userId: req.user._id,
      mineOnly,
    };

    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "csv") {
      const { csv, count } = await buildDatasetCsv(options);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="BAREAI-dataset-${stamp}.csv"`
      );
      res.setHeader("X-Dataset-Count", String(count));
      return res.send(csv);
    }

    const { buffer, count } = await buildDatasetWorkbook(options);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="BAREAI-dataset-${stamp}.xlsx"`
    );
    res.setHeader("X-Dataset-Count", String(count));
    return res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("Dataset export error:", error);
    res.status(500).json({
      message: "Dataset export failed",
      error: error.message,
    });
  }
});

// ── My History (per-user) ──────────────────────────────────────
router.get("/my", protect, async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const filter = { user: req.user._id, sourceType: { $ne: "facebook" } };

    const [total, crime, notCrime, records] = await Promise.all([
      History.countDocuments(filter),
      History.countDocuments({ ...filter, isCrime: true }),
      History.countDocuments({ ...filter, isCrime: false }),
      History.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("type sourceType content prediction confidence isCrime matchedKeyword createdAt")
        .lean(),
    ]);

    res.json({
      stats: { total, crime, notCrime },
      page,
      totalPages: Math.ceil(total / limit),
      records,
    });
  } catch (error) {
    console.error("My history error:", error);
    res.status(500).json({ message: "My history error", error: error.message });
  }
});

// 1. General History
router.get("/general", protect, investigatorOrAdmin, async (req, res) => {
  try {
    const data = await History.find({
      sourceType: { $ne: "facebook" },
      $or: [
        { blacklistMatches: { $exists: false } },
        { blacklistMatches: { $size: 0 } },
        { blacklistMatches: null }
      ]
    }).sort({ createdAt: -1 });

    res.json(data);
  } catch (error) {
    console.error("General history error:", error);
    res.status(500).json({ message: "General history error", error: error.message });
  }
});

// 2. Blacklist History
router.get("/blacklist", protect, investigatorOrAdmin, async (req, res) => {
  try {
    const data = await History.find({
      sourceType: { $ne: "facebook" },
      blacklistMatches: { $exists: true, $ne: [] }
    }).sort({ createdAt: -1 });

    res.json(data);
  } catch (error) {
    console.error("Blacklist history error:", error);
    res.status(500).json({ message: "Blacklist history error", error: error.message });
  }
});

// Old all history haddii aad rabto
router.get("/", protect, async (req, res) => {
  try {
    const filter = canViewAllHistory(req.user)
      ? { sourceType: { $ne: "facebook" } }
      : { user: req.user._id, sourceType: { $ne: "facebook" } };
    const data = await History.find(filter).sort({ createdAt: -1 });
    res.json(data);
  } catch (error) {
    console.error("History error:", error);
    res.status(500).json({ message: "History error", error: error.message });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    const filter = canViewAllHistory(req.user)
      ? { _id: req.params.id }
      : { _id: req.params.id, user: req.user._id };
    const deleted = await History.findOneAndDelete(filter);

    if (!deleted) {
      return res.status(404).json({ message: "History record not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Delete history error:", error);
    res.status(500).json({ message: "Delete history error", error: error.message });
  }
});

module.exports = router;
