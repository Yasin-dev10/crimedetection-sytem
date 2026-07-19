const ActivityLog = require("../model/ActivityLog");

/**
 * Write an activity log entry. Never throws — logging must never break
 * the business operation that triggered it.
 */
const logActivity = async ({
  req = null,
  user = null,
  action,
  resourceType = null,
  resourceId = null,
  details = null,
  sessionId = null,
} = {}) => {
  try {
    if (!action) return null;

    const actor = user || req?.user;
    const actorId = actor?._id || actor?.id;
    if (!actorId) return null;

    const forwardedFor = req?.headers?.["x-forwarded-for"];
    const ip =
      req?.ip ||
      (typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : null) ||
      req?.socket?.remoteAddress ||
      null;

    return await ActivityLog.create({
      user: actorId,
      role: actor.role || null,
      action,
      sessionId: sessionId || req?.authSessionId || null,
      resourceType,
      resourceId: resourceId || null,
      details,
      ip,
      userAgent: req?.headers?.["user-agent"] || null,
    });
  } catch (error) {
    console.error("ACTIVITY LOG ERROR:", error.message);
    return null;
  }
};

module.exports = { logActivity };
