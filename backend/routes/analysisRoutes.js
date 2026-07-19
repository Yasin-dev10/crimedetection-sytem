const express = require("express");
const multer = require("multer");

const {
  analyzeText,
  analyzeUrl,
  analyzeFile,
  analyzeBatch,
} = require("../controllers/analysisController");

const { optionalProtect } = require("../middleware/authMiddleware");
const { guestAnalysisLimit } = require("../middleware/guestLimitMiddleware");

const router = express.Router();

const upload = multer({
  dest: "uploads/",
});

/* Text */
router.post("/text", optionalProtect, guestAnalysisLimit, analyzeText);

/* Single URL */
router.post("/url", optionalProtect, guestAnalysisLimit, analyzeUrl);

/* File PDF / DOCX / TXT */
router.post("/file", optionalProtect, upload.single("file"), guestAnalysisLimit, analyzeFile);

/* Batch Text or URL */
router.post("/batch", optionalProtect, guestAnalysisLimit, analyzeBatch);

module.exports = router;