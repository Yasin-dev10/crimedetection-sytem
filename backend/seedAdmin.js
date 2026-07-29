const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const User = require("./model/user");
const { validatePasswordStrength } = require("./utils/passwordPolicy");

dotenv.config();

const seedAdmin = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured in backend/.env");
  }

  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "";

  if (!email || !password) {
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env before running seedAdmin"
    );
  }

  const strength = validatePasswordStrength(password);
  if (!strength.ok) {
    throw new Error(strength.message);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await User.findOneAndUpdate(
    { email },
    {
      name: process.env.ADMIN_NAME || "BAREAI Admin",
      email,
      password: hashedPassword,
      role: "admin",
      status: "active",
      theme: "dark",
      emailAlerts: true,
      pushNotifications: false,
      emailVerified: true,
      emailVerificationOTP: null,
      emailVerificationOTPExpiry: null,
      isPasswordChangeRequired: true,
      activeSessionId: null,
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  console.log("==================================");
  console.log("Admin seed completed");
  console.log("Email:", admin.email);
  console.log("Password: [hidden — taken from ADMIN_PASSWORD env]");
  console.log("Role:", admin.role);
  console.log("Password change required on next login:", admin.isPasswordChangeRequired);
  console.log("==================================");
};

seedAdmin()
  .catch((error) => {
    console.error("Admin seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
