/**
 * Smoke test — no Twilio credentials or SMS required.
 */
const dotenv = require("dotenv");
const path = require("path");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../model/user");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const PORT = process.env.PORT || 5000;
const BASE = `http://localhost:${PORT}/api/auth`;

async function main() {
  console.log("=== Phone Verification Smoke Test ===\n");

  const health = await fetch(`http://localhost:${PORT}/`);
  if (!health.ok) throw new Error("Backend not running on port " + PORT);
  console.log("OK  Backend running");

  await mongoose.connect(process.env.MONGO_URI);
  const admin = await User.findOne({
    email: (process.env.ADMIN_EMAIL || "admin@bareai.com").trim().toLowerCase(),
  });
  if (!admin) throw new Error("Admin missing — run npm run seed:admin");
  console.log("OK  Admin user exists");

  const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  const unconfigured = await fetch(`${BASE}/send-phone-verification`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone: "+10000000000" }),
  });

  const body = await unconfigured.json();
  const twilioReady = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_VERIFY_SERVICE_SID
  );

  if (!twilioReady) {
    if (unconfigured.status !== 503) {
      throw new Error(`Expected 503 without Twilio config, got ${unconfigured.status}`);
    }
    console.log("OK  Returns 503 when Twilio not configured");
    console.log("\nNext: add TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN to .env, then:");
    console.log("  npm run twilio:setup");
    console.log("  npm run twilio:test -- +252XXXXXXXXX");
    return;
  }

  if (unconfigured.status !== 200 && unconfigured.status !== 502) {
    throw new Error(`Unexpected send status ${unconfigured.status}: ${body.message}`);
  }
  console.log("OK  Twilio configured — send endpoint responded:", unconfigured.status, body.message);
  console.log("\nRun full SMS test:");
  console.log("  npm run twilio:test -- +252XXXXXXXXX");
}

main()
  .catch((e) => {
    console.error("FAIL", e.message);
    process.exit(1);
  })
  .finally(async () => {
    if (mongoose.connection.readyState === 1) await mongoose.disconnect();
  });
