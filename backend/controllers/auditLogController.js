const ActivityLog = require("../model/ActivityLog");
const { MODULES, SUPERVISOR_MODULES, getActionMeta, buildDescription } = require("../utils/auditMeta");

const parseDateBoundary = (value, endOfDay = false) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) {
    d.setHours(23, 59, 59, 999);
  }
  return d;
};

const formatLogEntry = (log) => {
  const populatedUser = log.user && typeof log.user === "object" ? log.user : null;
  const action = log.action;
  const meta = getActionMeta(action);
  const moduleName = log.module || meta.module;
  const description =
    log.description || buildDescription(action, log.details);

  return {
    id: log._id?.toString(),
    _id: log._id,
    user: {
      id: populatedUser?._id?.toString() || (log.user?.toString?.() ?? null),
      name: populatedUser?.name || log.userName || "Unknown",
      email: populatedUser?.email || log.details?.email || null,
      role: populatedUser?.role || log.role || null,
    },
    role: populatedUser?.role || log.role || null,
    action,
    actionLabel: meta.label,
    module: moduleName,
    description,
    status: log.status || "success",
    ip: log.ip || null,
    userAgent: log.userAgent || null,
    resourceType: log.resourceType || null,
    resourceId: log.resourceId || null,
    details: log.details || null,
    sessionId: log.sessionId || null,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
};

/**
 * GET /api/audit-logs
 *
 * Access:
 * - admin: all logs
 * - investigator: own logs only
 * - user (CDI): forbidden
 *
 * Query: page, limit, action, module, status, userId, search, from, to
 */
const getAuditLogs = async (req, res) => {
  try {
    const role = req.user?.role;
    if (!["admin", "investigator"].includes(role)) {
      return res.status(403).json({ message: "You do not have access to Audit Logs" });
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;

    const filter = {};

    // Investigators only see their own activity
    if (role === "investigator") {
      filter.user = req.user._id;
    } else if (req.query.userId) {
      filter.user = req.query.userId;
    }

    // Optional "supervisor-style" scope for admins: cases + users only
    if (role === "admin" && req.query.scope === "supervisor") {
      filter.module = { $in: SUPERVISOR_MODULES };
    }

    if (req.query.action) {
      filter.action = String(req.query.action).trim();
    }

    if (req.query.module) {
      filter.module = String(req.query.module).trim();
    }

    if (req.query.status && ["success", "failed"].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const from = parseDateBoundary(req.query.from, false);
    const to = parseDateBoundary(req.query.to, true);
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = from;
      if (to) filter.createdAt.$lte = to;
    }

    const search = String(req.query.search || "").trim();
    if (search) {
      const searchRegex = new RegExp(
        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
      filter.$or = [
        { description: searchRegex },
        { userName: searchRegex },
        { action: searchRegex },
        { module: searchRegex },
        { ip: searchRegex },
        { "details.email": searchRegex },
        { "details.targetName": searchRegex },
        { "details.name": searchRegex },
      ];
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .populate("user", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(filter),
    ]);

    // Backfill module/description for legacy rows missing them
    const items = logs.map((log) => {
      if (!log.module || !log.description) {
        const meta = getActionMeta(log.action);
        return formatLogEntry({
          ...log,
          module: log.module || meta.module,
          description: log.description || buildDescription(log.action, log.details),
          status: log.status || "success",
        });
      }
      return formatLogEntry(log);
    });

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch audit logs",
      error: error.message,
    });
  }
};

/**
 * GET /api/audit-logs/meta — filter options for the UI
 */
const getAuditLogMeta = async (req, res) => {
  try {
    const role = req.user?.role;
    if (!["admin", "investigator"].includes(role)) {
      return res.status(403).json({ message: "You do not have access to Audit Logs" });
    }

    const actionFilter = role === "investigator" ? { user: req.user._id } : {};

    const [actions, modulesFromDb] = await Promise.all([
      ActivityLog.distinct("action", actionFilter),
      ActivityLog.distinct("module", {
        ...actionFilter,
        module: { $ne: null },
      }),
    ]);

    const modules = Array.from(
      new Set([...MODULES, ...modulesFromDb.filter(Boolean)])
    ).sort();

    res.json({
      modules,
      actions: actions.filter(Boolean).sort(),
      statuses: ["success", "failed"],
      access: {
        role,
        canViewAll: role === "admin",
        ownOnly: role === "investigator",
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch audit log metadata",
      error: error.message,
    });
  }
};

/**
 * GET /api/audit-logs/stats — summary cards
 */
const getAuditLogStats = async (req, res) => {
  try {
    const role = req.user?.role;
    if (!["admin", "investigator"].includes(role)) {
      return res.status(403).json({ message: "You do not have access to Audit Logs" });
    }

    const baseFilter = role === "investigator" ? { user: req.user._id } : {};
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [total, failed, last7Days, byModule] = await Promise.all([
      ActivityLog.countDocuments(baseFilter),
      ActivityLog.countDocuments({ ...baseFilter, status: "failed" }),
      ActivityLog.countDocuments({
        ...baseFilter,
        createdAt: { $gte: since },
      }),
      ActivityLog.aggregate([
        { $match: baseFilter },
        {
          $group: {
            _id: {
              $ifNull: ["$module", "System"],
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
    ]);

    res.json({
      total,
      failed,
      last7Days,
      byModule: byModule.map((row) => ({
        module: row._id,
        count: row.count,
      })),
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch audit log stats",
      error: error.message,
    });
  }
};

module.exports = {
  getAuditLogs,
  getAuditLogMeta,
  getAuditLogStats,
};
