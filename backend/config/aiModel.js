const AI_MODEL_URL = process.env.AI_MODEL_URL || "http://localhost:5001/predict";
const AI_MODEL_HEALTH_URL =
  process.env.AI_MODEL_HEALTH_URL ||
  AI_MODEL_URL.replace(/\/predict\/?$/, "/health");

module.exports = {
  AI_MODEL_URL,
  AI_MODEL_HEALTH_URL,
};
