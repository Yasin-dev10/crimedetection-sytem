const mongoose = require("mongoose");

const blacklistAlertSchema = new mongoose.Schema(
  {
    blacklistItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlacklistItem",
      required: true,
    },

    history: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "History",
      default: null,
    },

    sourceType: {
      type: String,
      enum: ["text", "url", "file", "batch", "facebook", "website"],
      default: "facebook",
    },

    content: {
      type: String,
      required: true,
    },

    matchedValue: {
      type: String,
      required: true,
    },

    contentFingerprint: {
      type: String,
      required: true,
      index: true,
    },

    dayKey: {
      type: String,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["new", "reviewed", "sent_to_investigation"],
      default: "new",
    },

    postId: {
      type: String,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

blacklistAlertSchema.index(
  {
    blacklistItem: 1,
    contentFingerprint: 1,
    dayKey: 1,
  },
  {
    unique: true,
  }
);
module.exports =
  mongoose.models.BlacklistAlert ||
  mongoose.model("BlacklistAlert", blacklistAlertSchema);
