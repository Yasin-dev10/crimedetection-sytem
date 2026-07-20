const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
      index: true,
    },
    /** Display name snapshot (useful when user is deleted or login failed) */
    userName: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      default: null,
    },
    // e.g. login, logout, case_created, user_created, blacklist_entry_added
    action: {
      type: String,
      required: true,
      index: true,
    },
    module: {
      type: String,
      default: null,
      index: true,
    },
    description: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success",
      index: true,
    },
    sessionId: {
      type: String,
      default: null,
    },
    resourceType: {
      type: String,
      default: null,
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ user: 1, action: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ module: 1, createdAt: -1 });
activityLogSchema.index({ status: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });

module.exports =
  mongoose.models.ActivityLog || mongoose.model("ActivityLog", activityLogSchema);
