/**
 * End-to-end test for SMS phone verification endpoints.
 * Usage: node scripts/testPhoneVerification.js [phone] [code]
 *
 * Without code: sends SMS and prints next step.
 * With code: verifies the submitted OTP.
 */
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const BASE = `http://localhost:${process.env.PORT || 5000}/api/auth`;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@bareai.com").trim().toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@12345";
const TEST_PHONE = process.argv[2] || process.env.TEST_PHONE || "";
const VERIFY_CODE = process.argv[3] || "";

async function request(method, urlPath, body, token) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  console.log("=== BAREAI Phone Verification Test ===\n");

  const health = await fetch(`http://localhost:${process.env.PORT || 5000}/`);
  if (!health.ok) {
    console.error("Backend is not running. Start it with: npm run dev");
    process.exit(1);
  }
  console.log("1. Backend is up");

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_VERIFY_SERVICE_SID) {
    console.error("\nTwilio is not configured in backend/.env");
    console.error("Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, then run:");
    console.error("  node scripts/setupTwilioVerify.js");
    process.exit(1);
  }
  console.log("2. Twilio env vars present");

  const login = await request("POST", "/login", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  if (login.status === 403 && login.data.requiresVerification) {
    console.error("\nAdmin email not verified. Run: npm run seed:admin");
    process.exit(1);
  }

  if (login.status !== 200 || !login.data.requiresOTP) {
    console.error("\nLogin failed:", login.status, login.data);
    process.exit(1);
  }

  const otpRes = await request("POST", "/verify-login-otp", {
    email: ADMIN_EMAIL,
    otp: "000000",
  });

  if (otpRes.status === 400) {
    console.log("3. Admin login requires email OTP (expected). Checking email inbox...");
    console.log("\n   For automated test, set admin emailVerified=true in DB or use a test user.");
    console.log("   Trying direct token via seed workaround...\n");
  }

  // Use a lightweight path: patch me requires token. Login OTP blocks us unless we know the code.
  // Seed admin with emailVerified and skip login OTP by using mongoose directly for token.
  const jwt = require("jsonwebtoken");
  const mongoose = require("mongoose");
  const User = require("../model/user");

  await mongoose.connect(process.env.MONGO_URI);
  const admin = await User.findOne({ email: ADMIN_EMAIL });
  if (!admin) {
    console.error("Admin user not found. Run: npm run seed:admin");
    process.exit(1);
  }

  admin.emailVerified = true;
  if (TEST_PHONE) admin.phone = TEST_PHONE;
  admin.phoneVerified = false;
  await admin.save();

  const token = jwt.sign({ id: admin._id, role: admin.role }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  console.log("3. Test session ready (admin)");

  if (!TEST_PHONE) {
    console.error("\nProvide a phone number (E.164 or local):");
    console.error("  node scripts/testPhoneVerification.js +252XXXXXXXXX");
    console.error("\nTrial accounts: verify the number first at:");
    console.error("  https://console.twilio.com/us1/develop/phone-numbers/verified-caller-ids");
    process.exit(1);
  }

  if (!VERIFY_CODE) {
    const send = await request(
      "POST",
      "/send-phone-verification",
      { phone: TEST_PHONE },
      token
    );

    console.log("\n4. Send SMS:", send.status, send.data.message || send.data);

    if (send.status === 200) {
      console.log("\nSMS sent. Re-run with the 6-digit code:");
      console.log(`  node scripts/testPhoneVerification.js ${TEST_PHONE} 123456`);
    } else {
      process.exit(1);
    }
    return;
  }

  const verify = await request(
    "POST",
    "/verify-phone",
    { code: VERIFY_CODE },
    token
  );

  console.log("\n4. Verify phone:", verify.status, verify.data.message || verify.data);

  if (verify.status === 200) {
    const refreshed = await User.findById(admin._id);
    console.log("\n5. phoneVerified in DB:", refreshed.phoneVerified);
    console.log("\n=== TEST PASSED ===");
  } else {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("Test failed:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    const mongoose = require("mongoose");
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }
  });
