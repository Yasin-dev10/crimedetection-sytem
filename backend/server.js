const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
dotenv.config();

// Some managed/local environments inject a deliberately unreachable proxy
// such as 127.0.0.1:9. Leaving it active breaks website monitoring even when
// the target URL itself is valid. Remove only this known-local dead proxy;
// legitimate configured proxies remain untouched.
for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) {
  const value = process.env[key];
  if (!value) continue;

  try {
    const proxyUrl = new URL(value);
    const isLocalDeadProxy =
      ["127.0.0.1", "localhost", "::1"].includes(proxyUrl.hostname) &&
      proxyUrl.port === "9";
    if (isLocalDeadProxy) delete process.env[key];
  } catch {
    // Ignore malformed proxy values here; individual requests still validate
    // their own targets and report useful errors.
  }
}

const connectDB = require("./config/db");
const path = require("path");
const {
  authRateLimiter,
  analysisRateLimiter,
} = require("./middleware/rateLimitMiddleware");

const authRoutes = require("./routes/authRoutes");
const analysisRoutes = require("./routes/analysisRoutes");
const historyRoutes = require("./routes/historyRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const modelRoutes = require("./routes/modelRoutes");
const investigationRoutes = require("./routes/investigationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const blacklistRoutes = require("./routes/blacklistRoutes");
const userRoutes = require("./routes/userRoutes");
const reportRoutes = require("./routes/reportRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");

connectDB();

const app = express();

const trustProxyHops = Number(process.env.TRUST_PROXY || 0);
if (trustProxyHops > 0) {
  app.set("trust proxy", trustProxyHops);
}

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
].filter(Boolean);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders(res) {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", "inline");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

app.use("/api/auth", authRateLimiter, authRoutes);
app.use("/api/analysis", analysisRateLimiter, analysisRoutes);
app.use("/api/model", modelRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/investigation", investigationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/blacklist", blacklistRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/audit-logs", auditLogRoutes);

app.get("/", (req, res) => {
  res.json({ message: "Crime Detection Backend Running" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  try {
    const { startFacebookMonitor } = require("./services/facebookMonitor");
    startFacebookMonitor();
  } catch (error) {
    console.error("Facebook monitor failed to start:", error.message);
  }
});
