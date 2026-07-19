const express = require("express");
const router = express.Router();

const History = require("../model/History");
const { protect, investigatorOrAdmin } = require("../middleware/authMiddleware");

const canViewAllHistory = (user) =>
  user && ["admin", "investigator"].includes(user.role);

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
