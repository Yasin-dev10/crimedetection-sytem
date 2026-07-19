/**
 * Limits for guests (not logged in):
 * - Max 2 free analyses in total (text, url, file and batch combined).
 * - Max text length per analysis.
 * Tracked in-memory per IP address; logged-in users are never limited.
 */
const GUEST_MAX_ANALYSES = 2;
const GUEST_MAX_TEXT_LENGTH = 1000;

const guestUsage = new Map(); // ip -> analyses used

const getClientIp = (req) =>
  (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
  req.ip ||
  req.connection?.remoteAddress ||
  "unknown";

const guestAnalysisLimit = (req, res, next) => {
  if (req.user) return next();

  const ip = getClientIp(req);
  const used = guestUsage.get(ip) || 0;

  // Guest text length limit (text + batch items)
  if (typeof req.body?.text === "string" && req.body.text.length > GUEST_MAX_TEXT_LENGTH) {
    return res.status(403).json({
      message: `Guest text is limited to ${GUEST_MAX_TEXT_LENGTH} characters. Create a free account for unlimited analysis.`,
      requiresAccount: true,
    });
  }

  // Batch counts every item against the limit
  const batchItems = Array.isArray(req.body?.items) ? req.body.items.length : 0;
  const cost = Math.max(1, batchItems);

  if (used >= GUEST_MAX_ANALYSES || used + cost > GUEST_MAX_ANALYSES) {
    return res.status(403).json({
      message:
        "You have used your 2 free analyses. Please create a free account to continue analyzing.",
      requiresAccount: true,
    });
  }

  guestUsage.set(ip, used + cost);
  next();
};

module.exports = { guestAnalysisLimit, GUEST_MAX_ANALYSES, GUEST_MAX_TEXT_LENGTH };
