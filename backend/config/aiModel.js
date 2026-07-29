const AI_MODEL_URL = process.env.AI_MODEL_URL || "http://127.0.0.1:5001/predict";
const AI_MODEL_HEALTH_URL =
  process.env.AI_MODEL_HEALTH_URL ||
  AI_MODEL_URL.replace(/\/predict\/?$/, "/health");
const AI_MODEL_API_KEY = (process.env.AI_MODEL_API_KEY || "").trim();

const aiModelRequestConfig = (extra = {}) => {
  const headers = { ...(extra.headers || {}) };
  if (AI_MODEL_API_KEY) {
    headers["X-API-Key"] = AI_MODEL_API_KEY;
  }
  return { ...extra, headers };
};

module.exports = {
  AI_MODEL_URL,
  AI_MODEL_HEALTH_URL,
  AI_MODEL_API_KEY,
  aiModelRequestConfig,
};
