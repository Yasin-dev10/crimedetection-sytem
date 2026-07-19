const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    case: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InvestigationCase",
      default: null,
    },
    type: {
      type: String,
      enum: [
        "case_assigned",
        "case_updated",
        "mention",
        "crime_detected",
        "case_available",
        "case_taken",
      ],
      default: "case_assigned",
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
    // false = removed from investigator queue after another officer accepted
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, active: 1, read: 1, createdAt: -1 });
notificationSchema.index({ case: 1, type: 1, active: 1 });

module.exports =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);
