const mongoose = require("mongoose");

const blacklistMatchSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BlacklistItem",
    },
    type: String,
    value: String,
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    city: String,
    district_or_city: String,
    region: String,
    country: String,
  },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["text", "file", "url", "batch"],
      default: "text",
    },

    sourceType: {
      type: String,
      enum: ["text", "file", "url", "batch", "facebook", "website"],
      required: true,
    },

    content: {
      type: String,
      required: true,
    },

    url: {
      type: String,
      default: null,
    },

    postId: {
      type: String,
      unique: true,
      sparse: true,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    authorName: {
      type: String,
      default: null,
    },

    pageName: {
      type: String,
      default: null,
    },

    prediction: {
      type: String,
      default: "not crime-related",
    },

    label: {
      type: String,
      default: null,
    },

    confidence: {
      type: Number,
      default: 0,
    },

    isCrime: {
      type: Boolean,
      default: false,
    },

    matchedKeyword: {
      type: String,
      default: null,
    },

    location: {
      type: [locationSchema],
      default: [],
    },

    extractedText: {
      type: String,
      default: "",
    },

    blacklistMatches: {
      type: [blacklistMatchSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ["clean", "blocked", "duplicate"],
      default: "clean",
    },

    investigationStatus: {
      type: String,
      enum: [
        "pending",
        "sent_to_investigation",
        "under_review",
        "crime_case",
        "not_crime",
        "false_report",
        "misleading_information",
        "malicious_report",
        "resolved",
        "closed",
      ],
      default: "pending",
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.History || mongoose.model("History", historySchema);
