const express = require("express");
const { getModelInfo } = require("../controllers/modelController");

const router = express.Router();

router.get("/info", getModelInfo);

module.exports = router;
