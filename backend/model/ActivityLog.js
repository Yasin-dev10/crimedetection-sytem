const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      default: null,
    },
    // e.g. login, logout, case_created, case_assigned, case_claimed,
    // case_updated, case_resolved, case_note_added
    action: {
      type: String,
      required: true,
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

module.exports =
  mongoose.models.ActivityLog || mongoose.model("ActivityLog", activityLogSchema);
