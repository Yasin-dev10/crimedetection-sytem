const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const User = require("./model/user");
const { validatePasswordStrength } = require("./utils/passwordPolicy");

dotenv.config();

async function seedDatasetManager() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured in backend/.env");
  }

  const email = (process.env.DATASET_MANAGER_EMAIL || "").trim().toLowerCase();
  const password = process.env.DATASET_MANAGER_PASSWORD || "";
  const name = (process.env.DATASET_MANAGER_NAME || "BAREAI Dataset Manager").trim();

  if (!email || !password) {
    throw new Error(
      "Set DATASET_MANAGER_EMAIL and DATASET_MANAGER_PASSWORD in backend/.env"
    );
  }

  const strength = validatePasswordStrength(password);
  if (!strength.ok) {
    throw new Error(strength.message);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const hashedPassword = await bcrypt.hash(password, 10);

  const manager = await User.findOneAndUpdate(
    { email },
    {
      name,
      email,
      password: hashedPassword,
      role: "dataset_manager",
      status: "active",
      account_status: "active",
      theme: "light",
      emailVerified: true,
      emailVerificationOTP: null,
      emailVerificationOTPExpiry: null,
      isPasswordChangeRequired: false,
      passwordChangedAt: new Date(),
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
  console.log("Dataset Manager seed completed");
  console.log("Email:", manager.email);
  console.log("Password: [hidden - taken from DATASET_MANAGER_PASSWORD env]");
  console.log("Role:", manager.role);
  console.log("Password change required on next login:", manager.isPasswordChangeRequired);
  console.log("==================================");
}

seedDatasetManager()
  .catch((error) => {
    console.error("Dataset Manager seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
