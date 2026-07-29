const jwt = require("jsonwebtoken");
const User = require("../model/user");
const { AUTH_USER_FIELDS } = require("../utils/userSelect");

const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    return req.headers.authorization.split(" ")[1];
  }
  if (req.cookies?.token) return req.cookies.token;
  return null;
};

const attachUserFromToken = async (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.id).select(AUTH_USER_FIELDS);

  if (!user) {
    const error = new Error("User not found");
    error.status = 401;
    throw error;
  }

  if (decoded.sessionId) {
    if (!user.activeSessionId || user.activeSessionId !== decoded.sessionId) {
      const error = new Error("Session expired");
      error.status = 401;
      throw error;
    }
  }

  return { user, sessionId: decoded.sessionId || null };
};

const protect = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ message: "No token" });

    const { user, sessionId } = await attachUserFromToken(token);
    req.user = user;
    req.authSessionId = sessionId;

    const accountStatus = req.user.account_status || "active";
    if (
      req.user.role === "user" &&
      (accountStatus === "blocked" || accountStatus === "suspended")
    ) {
      return res.status(403).json({
        message:
          accountStatus === "blocked"
            ? "Your account has been blocked due to repeated false or malicious reports."
            : "Your account is temporarily suspended pending review.",
        account_status: accountStatus,
      });
    }

    next();
  } catch (error) {
    res.status(401).json({ message: error.message === "Session expired" ? "Session expired" : "Token failed" });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Admin only" });
  }
};

const investigatorOrAdmin = (req, res, next) => {
  if (req.user && ["admin", "investigator"].includes(req.user.role)) {
    next();
  } else {
    res.status(403).json({ message: "Investigator or admin only" });
  }
};

const datasetManagerOnly = (req, res, next) => {
  if (req.user && req.user.role === "dataset_manager") {
    return next();
  }
  return res.status(403).json({ message: "Dataset Manager only" });
};

const optionalProtect = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      const { user, sessionId } = await attachUserFromToken(token);
      req.user = user;
      req.authSessionId = sessionId;
    }
  } catch {
    // No valid token — continue as guest
  }
  next();
};

module.exports = {
  protect,
  adminOnly,
  investigatorOrAdmin,
  datasetManagerOnly,
  optionalProtect,
};
