/**
 * Limits for guests (not logged in):
 * - Max 2 free analyses in total (text, url, file and batch combined).
 * - Max text length per analysis.
 * Tracked in-memory per IP address; logged-in users are never limited.
 *
 * Only trust X-Forwarded-For when Express trust proxy is enabled.
 */
const GUEST_MAX_ANALYSES = 2;
const GUEST_MAX_TEXT_LENGTH = 1000;

const guestUsage = new Map(); // ip -> analyses used

const getClientIp = (req) => {
  if (req.app?.get("trust proxy")) {
    const forwarded = (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (forwarded) return forwarded;
  }
  return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown";
};

const guestAnalysisLimit = (req, res, next) => {
  if (req.user) return next();

  const ip = getClientIp(req);
  const used = guestUsage.get(ip) || 0;

  if (typeof req.body?.text === "string" && req.body.text.length > GUEST_MAX_TEXT_LENGTH) {
    return res.status(403).json({
      message: `Martiga waxaa loo xadiday ${GUEST_MAX_TEXT_LENGTH} xaraf. Samee akoon bilaash ah si aad u hesho analysis xadidan.`,
      requiresAccount: true,
    });
  }

  const batchItems = Array.isArray(req.body?.items) ? req.body.items.length : 0;
  const cost = Math.max(1, batchItems);

  if (used >= GUEST_MAX_ANALYSES || used + cost > GUEST_MAX_ANALYSES) {
    return res.status(403).json({
      message:
        "Waxaad isticmaashay 2 analysis ee bilaashka ah. Fadlan samee akoon si aad u sii waddo.",
      requiresAccount: true,
    });
  }

  guestUsage.set(ip, used + cost);
  next();
};

module.exports = { guestAnalysisLimit, GUEST_MAX_ANALYSES, GUEST_MAX_TEXT_LENGTH };
