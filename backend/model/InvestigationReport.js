const mongoose = require("mongoose");

/**
 * Formal investigation report owned by the investigator who wrote it.
 * Investigators only see/edit their own; admins see/manage all.
 */
const investigationReportSchema = new mongoose.Schema(
  {
    case: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InvestigationCase",
      required: true,
      index: true,
    },
    investigator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    findings: {
      type: String,
      default: "",
    },
    recommendation: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["draft", "submitted", "finalized"],
      default: "draft",
      index: true,
    },
  },
  { timestamps: true }
);

// One report per investigator per case
investigationReportSchema.index({ case: 1, investigator: 1 }, { unique: true });
investigationReportSchema.index({ investigator: 1, createdAt: -1 });

module.exports =
  mongoose.models.InvestigationReport ||
  mongoose.model("InvestigationReport", investigationReportSchema);
