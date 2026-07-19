const jwt = require("jsonwebtoken");
const User = require("../model/user");

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) return res.status(401).json({ message: "No token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id).select("-password");
    req.authSessionId = decoded.sessionId || null;

    if (!req.user) return res.status(401).json({ message: "User not found" });

    next();
  } catch (error) {
    res.status(401).json({ message: "Token failed" });
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

// Optional: attaches req.user if token is present, but never rejects
const optionalProtect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer")) {
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      req.authSessionId = decoded.sessionId || null;
    }
  } catch {
    // No valid token — continue as guest
  }
  next();
};

module.exports = { protect, adminOnly, investigatorOrAdmin, optionalProtect };
