const express = require("express");
const {
  getMyNotifications,
  getUnreadCount,
  markNotificationRead,
} = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, getMyNotifications);
router.get("/unread-count", protect, getUnreadCount);
router.patch("/:id/read", protect, markNotificationRead);

module.exports = router;