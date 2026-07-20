const ActivityLog = require("../model/ActivityLog");
const { getActionMeta, buildDescription } = require("./auditMeta");

/**
 * Write an activity / audit log entry. Never throws — logging must never break
 * the business operation that triggered it.
 *
 * @param {object} options
 * @param {object} [options.req] Express request (for IP / user-agent / actor)
 * @param {object} [options.user] Actor user document (falls back to req.user)
 * @param {string} options.action Action key (e.g. login, case_assigned)
 * @param {string} [options.module] Override module (auto from action if omitted)
 * @param {string} [options.description] Override description
 * @param {"success"|"failed"} [options.status="success"]
 * @param {string} [options.resourceType]
 * @param {string|object} [options.resourceId]
 * @param {object} [options.details]
 * @param {string} [options.sessionId]
 * @param {string} [options.userName] Snapshot name when user id is missing
 * @param {string} [options.role] Snapshot role when user id is missing
 */
const logActivity = async ({
  req = null,
  user = null,
  action,
  module: moduleOverride = null,
  description: descriptionOverride = null,
  status = "success",
  resourceType = null,
  resourceId = null,
  details = null,
  sessionId = null,
  userName = null,
  role = null,
} = {}) => {
  try {
    if (!action) return null;

    const actor = user || req?.user || null;
    const actorId = actor?._id || actor?.id || null;
    const meta = getActionMeta(action);
    const resolvedModule = moduleOverride || meta.module;
    const resolvedDescription = buildDescription(
      action,
      details,
      descriptionOverride
    );

    const forwardedFor = req?.headers?.["x-forwarded-for"];
    const ip =
      req?.ip ||
      (typeof forwardedFor === "string" ? forwardedFor.split(",")[0].trim() : null) ||
      req?.socket?.remoteAddress ||
      null;

    // Failed auth may have no user id — still record the attempt
    if (!actorId && status !== "failed" && action !== "login_failed") {
      return null;
    }

    return await ActivityLog.create({
      user: actorId || null,
      userName: userName || actor?.name || details?.email || null,
      role: role || actor?.role || null,
      action,
      module: resolvedModule,
      description: resolvedDescription,
      status: status === "failed" ? "failed" : "success",
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
