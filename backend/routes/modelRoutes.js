const express = require("express");
const { getModelInfo } = require("../controllers/modelController");
const { protect, investigatorOrAdmin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/info", protect, investigatorOrAdmin, getModelInfo);

module.exports = router;
