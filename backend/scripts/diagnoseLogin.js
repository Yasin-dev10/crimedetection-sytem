/**
 * Quick login diagnostic — does not mutate passwords.
 * Run: node scripts/diagnoseLogin.js [email] [password]
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../model/user");

async function main() {
  const email = (process.argv[2] || "admin@bareai.com").trim().toLowerCase();
  const password = process.argv[3] || "Admin@12345";

  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI missing in backend/.env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email });

  if (!user) {
    console.log("RESULT: user_not_found");
    console.log("HINT: run npm run seed:admin");
    process.exitCode = 1;
  } else {
    console.log("RESULT: user_found");
    console.log({
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerified,
      hasPassword: Boolean(user.password),
      passwordLooksHashed: String(user.password || "").startsWith("$2"),
      isPasswordChangeRequired: user.isPasswordChangeRequired,
    });

    const match = user.password
      ? await bcrypt.compare(password, user.password)
      : false;
    console.log("PASSWORD_MATCH:", match);
    if (!match) {
      console.log("HINT: wrong password, or re-run npm run seed:admin");
      process.exitCode = 1;
    }
  }

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("ERROR:", err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
