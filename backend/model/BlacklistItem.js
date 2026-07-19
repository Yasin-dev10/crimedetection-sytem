const mongoose = require("mongoose");

const blacklistItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["facebook_page", "website", "keyword", "person"],
      required: true,
    },
    name: { type: String, required: true },
    value: { type: String, required: true },
    reason: { type: String, default: "" },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "high",
    },
    active: { type: Boolean, default: true },
    monitorEnabled: { type: Boolean, default: true },
    lastScannedAt: { type: Date, default: null },
    lastScanStatus: { type: String, default: "not_scanned" },
    lastSeenPostId: { type: String, default: null },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.BlacklistItem ||
  mongoose.model("BlacklistItem", blacklistItemSchema);
