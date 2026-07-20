const mongoose = require("mongoose");

const caseNoteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    officer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const investigationCaseSchema = new mongoose.Schema(
  {
    history: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "History",
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "investigating",
        "crime_case",
        "not_crime",
        "false_report",
        "misleading_information",
        "malicious_report",
        "resolved",
        "archived",
      ],
      default: "pending",
    },
    /**
     * Investigator flags a citizen submission as false / misleading / malicious.
     * Admin must confirm before account sanctions are applied.
     */
    reportFlag: {
      type: {
        type: String,
        enum: ["false_report", "misleading_information", "malicious_report"],
      },
      reason: { type: String, default: "" },
      flaggedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      flaggedAt: { type: Date, default: null },
      reviewStatus: {
        type: String,
        enum: ["pending", "confirmed", "rejected"],
        default: null,
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      reviewedAt: { type: Date, default: null },
      adminAction: {
        type: String,
        enum: ["none", "warning", "under_review", "suspended", "blocked"],
        default: null,
      },
      adminNotes: { type: String, default: "" },
      reportingUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    category: {
      type: String,
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
      default: "general",
    },
    assignedOfficer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    /** When the investigator formally began work on this case */
    investigationStartedAt: {
      type: Date,
      default: null,
    },
    /** Investigator findings / discoveries recorded during the investigation */
    findings: {
      type: String,
      default: "",
    },
    notes: [caseNoteSchema],
    archived: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.InvestigationCase ||
  mongoose.model("InvestigationCase", investigationCaseSchema);
