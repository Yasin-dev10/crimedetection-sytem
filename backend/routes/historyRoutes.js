const express = require("express");
const router = express.Router();

const History = require("../model/History");
const {
  protect,
  investigatorOrAdmin,
  datasetManagerOnly,
} = require("../middleware/authMiddleware");
const {
  buildDatasetWorkbook,
  buildDatasetCsv,
  toDatasetRow,
} = require("../services/datasetStore");

const canViewAllHistory = (user) =>
  user && ["admin", "investigator"].includes(user.role);

// Export collected analysis data as Excel (.xlsx) for dataset study / retraining
// Query: ?source=all|analysis|facebook|website&scope=all|mine&format=xlsx|csv
router.get(
  "/dataset/export",
  protect,
  datasetManagerOnly,
  async (req, res) => {
  try {
    const format = String(req.query.format || "xlsx").toLowerCase();
    const source = String(req.query.source || "all").toLowerCase();
    const options = {
      source: ["all", "analysis", "facebook", "website"].includes(source)
        ? source
        : "all",
      mineOnly: false,
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
    });
  }
});

// Private dataset overview. No admin, investigator, or ordinary user can access it.
router.get("/dataset", protect, datasetManagerOnly, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;
    const source = String(req.query.source || "all").toLowerCase();
    const filter = {};

    if (source === "facebook") filter.sourceType = "facebook";
    else if (source === "website") filter.sourceType = "website";
    else if (source === "analysis") {
      filter.sourceType = { $nin: ["facebook", "website"] };
    }

    const [total, crime, notCrime, records] = await Promise.all([
      History.countDocuments(filter),
      History.countDocuments({ ...filter, isCrime: true }),
      History.countDocuments({ ...filter, isCrime: false }),
      History.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("sourceType content extractedText url prediction confidence isCrime matchedKeyword investigationStatus createdAt")
        .lean(),
    ]);

    res.json({
      stats: { total, crime, notCrime },
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      records: records.map((record) => ({
        _id: record._id,
        ...toDatasetRow(record),
      })),
    });
  } catch (error) {
    console.error("Dataset overview error:", error);
    res.status(500).json({ message: "Failed to load dataset" });
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
    res.status(500).json({ message: "My history error" });
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
    res.status(500).json({ message: "General history error" });
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
    res.status(500).json({ message: "Blacklist history error" });
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
    res.status(500).json({ message: "History error" });
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
    res.status(500).json({ message: "Delete history error" });
  }
});

module.exports = router;
