const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const connectDB = require("./config/db");
const path = require("path");

const authRoutes         = require("./routes/authRoutes");
const analysisRoutes     = require("./routes/analysisRoutes");
const historyRoutes      = require("./routes/historyRoutes");
const dashboardRoutes    = require("./routes/dashboardRoutes");
const modelRoutes        = require("./routes/modelRoutes");
const investigationRoutes = require("./routes/investigationRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const blacklistRoutes    = require("./routes/blacklistRoutes");
const userRoutes         = require("./routes/userRoutes");
const reportRoutes       = require("./routes/reportRoutes");

connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth",         authRoutes);
app.use("/api/analysis",     analysisRoutes);
app.use("/api/model",        modelRoutes);
app.use("/api/history",      historyRoutes);
app.use("/api/dashboard",    dashboardRoutes);
app.use("/api/investigation", investigationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/blacklist",    blacklistRoutes);
app.use("/api/users",        userRoutes);
app.use("/api/reports",      reportRoutes);

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
