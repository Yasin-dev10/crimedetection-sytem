/**
 * One-time setup: creates a Twilio Verify Service and prints the Service SID.
 * Usage: node scripts/setupTwilioVerify.js
 * Requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in backend/.env
 */
const dotenv = require("dotenv");
const twilio = require("twilio");
const fs = require("fs");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const envPath = path.join(__dirname, "..", ".env");

async function main() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN in backend/.env");
    console.error("Get them from: https://console.twilio.com/us1/account/keys-credentials/api-keys");
    process.exit(1);
  }

  const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  const service = await client.verify.v2.services.create({
    friendlyName: "BAREAI Phone Verification",
  });

  console.log("Verify Service created:");
  console.log(`  SID: ${service.sid}`);
  console.log(`  Name: ${service.friendlyName}`);

  let env = fs.readFileSync(envPath, "utf8");
  const line = `TWILIO_VERIFY_SERVICE_SID=${service.sid}`;

  if (/^TWILIO_VERIFY_SERVICE_SID=.*/m.test(env)) {
    env = env.replace(/^TWILIO_VERIFY_SERVICE_SID=.*/m, line);
  } else {
    if (!env.endsWith("\n")) env += "\n";
    env += `\n# Twilio Verify\nTWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}\nTWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}\n${line}\n`;
  }

  if (!/^TWILIO_ACCOUNT_SID=.*/m.test(env)) {
    env += `TWILIO_ACCOUNT_SID=${TWILIO_ACCOUNT_SID}\n`;
  }
  if (!/^TWILIO_AUTH_TOKEN=.*/m.test(env)) {
    env += `TWILIO_AUTH_TOKEN=${TWILIO_AUTH_TOKEN}\n`;
  }

  fs.writeFileSync(envPath, env);
  console.log("\nUpdated backend/.env with TWILIO_VERIFY_SERVICE_SID");
  console.log("Restart the backend, then run: node scripts/testPhoneVerification.js");
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
