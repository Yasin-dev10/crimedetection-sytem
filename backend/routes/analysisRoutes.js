const express = require("express");
const multer = require("multer");
const path = require("path");

const {
  analyzeText,
  analyzeUrl,
  analyzeFile,
  analyzeBatch,
} = require("../controllers/analysisController");

const { optionalProtect } = require("../middleware/authMiddleware");
const { guestAnalysisLimit } = require("../middleware/guestLimitMiddleware");

const router = express.Router();

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".doc",
  ".txt",
  ".csv",
  ".json",
  ".html",
  ".htm",
  ".md",
  ".markdown",
  ".rtf",
  ".xlsx",
]);

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    if (ALLOWED_UPLOAD_EXTENSIONS.has(extension)) {
      cb(null, true);
      return;
    }

    cb(
      new Error(
        "Unsupported file type. Allowed: PDF, DOC, DOCX, TXT, CSV, JSON, HTML, MD, RTF, XLSX"
      )
    );
  },
});

const uploadSingleFile = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();

    const details =
      err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
        ? "File is too large. Maximum size is 15MB."
        : err.message || "File upload failed";

    return res.status(400).json({
      message: details,
      error: details,
    });
  });
};

/* Text */
router.post("/text", optionalProtect, guestAnalysisLimit, analyzeText);

/* Single URL */
router.post("/url", optionalProtect, guestAnalysisLimit, analyzeUrl);

/* File: PDF / DOC / DOCX / TXT / CSV / JSON / HTML / MD / RTF / XLSX */
router.post("/file", optionalProtect, uploadSingleFile, guestAnalysisLimit, analyzeFile);

/* Batch Text or URL */
router.post("/batch", optionalProtect, guestAnalysisLimit, analyzeBatch);

module.exports = router;
