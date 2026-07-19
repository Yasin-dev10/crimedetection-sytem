const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const User = require("./model/user");

dotenv.config();

const adminSeed = {
  name: "BAREAI Admin",
  email: "nastexofeysal@gmail.com",
  password: "Password@2026",
};

const seedAdmin = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured in backend/.env");
  }

  await mongoose.connect(process.env.MONGO_URI);

  const hashedPassword = await bcrypt.hash(adminSeed.password, 10);

  const admin = await User.findOneAndUpdate(
    { email: adminSeed.email.toLowerCase() },
    {
      name: adminSeed.name,
      email: adminSeed.email.toLowerCase(),
      password: hashedPassword,
      role: "admin",
      status: "active",
      theme: "dark",
      emailAlerts: true,
      pushNotifications: false,
      emailVerified: true,
      emailVerificationOTP: null,
      emailVerificationOTPExpiry: null,
      isPasswordChangeRequired: false,
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  console.log("==================================");
  console.log("✅ Admin seed completed");
  console.log("Email:", admin.email);
  console.log("Password:", adminSeed.password);
  console.log("Role:", admin.role);
  console.log("==================================");
};

seedAdmin()
  .catch((error) => {
    console.error("❌ Admin seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });