const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    email: { type: String, required: true, unique: true },

    password: { type: String, required: true },

    role: {
      type: String,
      enum: ["admin", "investigator", "dataset_manager", "user"],
      default: "user",
    },

    badgeNumber: { type: String, default: null },

    station: { type: String, default: null },

    phone: { type: String, default: null },

    phoneVerified: {
      type: Boolean,
      default: false,
    },

    profileImage: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    /** Cumulative false / malicious / misleading report flags (investigator) */
    false_report_count: {
      type: Number,
      default: 0,
      min: 0,
    },

    is_flagged: {
      type: Boolean,
      default: false,
    },

    flag_reason: {
      type: String,
      default: null,
    },

    flagged_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    flagged_at: {
      type: Date,
      default: null,
    },

    /**
     * Discipline status — only admin applies sanctions after reviewing investigator flags.
     * Policy guide: 1=warning, 2=under_review, 3=suspended, 5+=blocked
     */
    account_status: {
      type: String,
      enum: ["active", "warning", "under_review", "suspended", "blocked"],
      default: "active",
    },

    theme: {
      type: String,
      enum: ["dark", "light"],
      default: "light",
    },

    emailAlerts: {
      type: Boolean,
      default: true,
    },

    pushNotifications: {
      type: Boolean,
      default: false,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
      default: null,
    },

    emailVerificationTokenExpiry: {
      type: Date,
      default: null,
    },

    emailVerificationOTP: {
      type: String,
      default: null,
    },

    emailVerificationOTPExpiry: {
      type: Date,
      default: null,
    },

    loginOTP: {
      type: String,
      default: null,
    },

    loginOTPExpiry: {
      type: Date,
      default: null,
    },

    passwordResetOTP: {
      type: String,
      default: null,
    },

    passwordResetOTPExpiry: {
      type: Date,
      default: null,
    },

    isPasswordChangeRequired: {
      type: Boolean,
      default: false,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
    },

    passwordChangeToken: {
      type: String,
      default: null,
    },

    passwordChangeTokenExpiry: {
      type: Date,
      default: null,
    },

    /** Current login session id — must match JWT sessionId or the token is rejected */
    activeSessionId: {
      type: String,
      default: null,
    },

    // Investigator specialization categories
    specializations: {
      type: [String],
      enum: [
        "murder",
        "robbery",
        "terrorism",
        "sexual_assault",
        "financial_fraud",
        "drug_crimes",
        "cybercrime",
        "general",
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// Phone must be unique when set (partial index so existing null phones don't clash)
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string" } } }
);

module.exports =
  mongoose.models.User || mongoose.model("User", userSchema);
