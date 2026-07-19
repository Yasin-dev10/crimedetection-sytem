const axios = require("axios");
const { AI_MODEL_URL, AI_MODEL_HEALTH_URL } = require("../config/aiModel");

const getModelInfo = async (req, res) => {
  const startedAt = Date.now();

  try {
    const response = await axios.get(AI_MODEL_HEALTH_URL, { timeout: 3000 });

    res.status(200).json({
      available: true,
      status: response.data?.status || "ok",
      message: response.data?.message || "AI Model Running",
      predictEndpoint: AI_MODEL_URL,
      latencyMs: Date.now() - startedAt,
      featureCount: 4,
      features: ["text", "url", "file", "batch"],
    });
  } catch (error) {
    res.status(200).json({
      available: false,
      status: "offline",
      message: "Python model is unavailable",
      predictEndpoint: AI_MODEL_URL,
      error: error.message,
      featureCount: 4,
      features: ["text", "url", "file", "batch"],
    });
  }
};

module.exports = {
  getModelInfo,
};
