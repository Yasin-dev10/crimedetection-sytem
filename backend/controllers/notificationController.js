const Notification = require("../model/Notification");

const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate({
        path: "case",
        populate: [
          { path: "history" },
          { path: "assignedOfficer", select: "name email role badgeNumber station" },
        ],
      })
      .sort({ createdAt: -1 });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch notifications",
      error: error.message,
    });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      read: false,
      active: { $ne: false },
      type: { $ne: "case_taken" },
    });

    res.json({ count });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch notification count",
      error: error.message,
    });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update notification",
      error: error.message,
    });
  }
};

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markNotificationRead,
};
