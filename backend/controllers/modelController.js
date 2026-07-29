const axios = require("axios");
const { AI_MODEL_HEALTH_URL, aiModelRequestConfig } = require("../config/aiModel");

const getModelInfo = async (req, res) => {
  const startedAt = Date.now();

  try {
    const response = await axios.get(
      AI_MODEL_HEALTH_URL,
      aiModelRequestConfig({ timeout: 3000 })
    );

    res.status(200).json({
      available: true,
      status: response.data?.status || "ok",
      message: response.data?.message || "AI Model Running",
      latencyMs: Date.now() - startedAt,
      features: ["text", "url", "file", "batch"],
    });
  } catch (error) {
    console.error("MODEL INFO ERROR:", error.message);
    res.status(200).json({
      available: false,
      status: "offline",
      message: "Python model is unavailable",
      latencyMs: Date.now() - startedAt,
      features: ["text", "url", "file", "batch"],
    });
  }
};

module.exports = {
  getModelInfo,
};
