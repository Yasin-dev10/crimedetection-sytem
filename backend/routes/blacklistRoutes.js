const express = require("express");

const {
  getBlacklistItems,
  createBlacklistItem,
  updateBlacklistItem,
  deleteBlacklistItem,
  getBlacklistAlerts,
  getFacebookPagePosts,
  getBlacklistItemDetails,
  resolveFacebookProfile,
  scanFacebookBlacklist,
  scanSingleFacebookBlacklist,
  scanWebsiteBlacklist,
  scanSingleWebsiteBlacklist,
  getWebsitePages,
  getFakeCrimeSubjects,
  getReportFlags,
  getBlacklistStats,
} = require("../controllers/blacklistController");

const {
  protect,
  adminOnly,
  investigatorOrAdmin,
} = require("../middleware/authMiddleware");

const router = express.Router();

/* ===========================
   VIEW (ADMIN + INVESTIGATOR)
=========================== */

router.get("/", protect, investigatorOrAdmin, getBlacklistItems);

router.get(
  "/alerts/history",
  protect,
  investigatorOrAdmin,
  getBlacklistAlerts
);

router.get(
  "/facebook/:id/posts",
  protect,
  investigatorOrAdmin,
  getFacebookPagePosts
);

router.get(
  "/website/:id/pages",
  protect,
  investigatorOrAdmin,
  getWebsitePages
);

router.get(
  "/stats/overview",
  protect,
  investigatorOrAdmin,
  getBlacklistStats
);

router.get(
  "/fake-crimes",
  protect,
  investigatorOrAdmin,
  getFakeCrimeSubjects
);

router.get(
  "/report-flags",
  protect,
  investigatorOrAdmin,
  getReportFlags
);

router.get(
  "/:id/details",
  protect,
  investigatorOrAdmin,
  getBlacklistItemDetails
);

/* ===========================
   SCAN (ADMIN + INVESTIGATOR)
=========================== */

router.post(
  "/facebook/scan",
  protect,
  investigatorOrAdmin,
  scanFacebookBlacklist
);

router.post(
  "/facebook/scan/:id",
  protect,
  investigatorOrAdmin,
  scanSingleFacebookBlacklist
);

router.post(
  "/website/scan",
  protect,
  investigatorOrAdmin,
  scanWebsiteBlacklist
);

router.post(
  "/website/scan/:id",
  protect,
  investigatorOrAdmin,
  scanSingleWebsiteBlacklist
);

/* ===========================
   ADMIN ONLY
=========================== */

router.post(
  "/facebook/resolve-profile",
  protect,
  adminOnly,
  resolveFacebookProfile
);

router.post(
  "/",
  protect,
  adminOnly,
  createBlacklistItem
);

router.patch(
  "/:id",
  protect,
  adminOnly,
  updateBlacklistItem
);

router.delete(
  "/:id",
  protect,
  adminOnly,
  deleteBlacklistItem
);

module.exports = router;
