require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../model/user");
const { isConfigured } = require("../services/twilioSmsService");

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const investigators = await User.find({ role: "investigator" }).select(
    "name phone pushNotifications"
  );

  console.log("Twilio SMS configured:", isConfigured());
  console.log("TWILIO_PHONE_NUMBER set:", Boolean(process.env.TWILIO_PHONE_NUMBER?.trim()));

  investigators.forEach((inv) => {
    const hasPhone = Boolean(inv.phone?.trim());
    console.log(
      `- ${inv.name}: phone=${hasPhone ? "yes" : "NO"}, pushNotifications=${inv.pushNotifications !== false}`
    );
  });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
