require("dotenv").config();
const { sendCaseAssignmentSms, isConfigured } = require("../services/twilioSmsService");

async function main() {
  const phone = process.argv[2] || "615588696";

  console.log("SMS configured:", isConfigured());

  const result = await sendCaseAssignmentSms({
    officer: { name: "Test Investigator", phone },
    investigationCase: {
      status: "investigating",
      category: "general",
      history: { sourceType: "facebook", content: "Test assignment notification" },
    },
  });

  console.log("Result:", result);
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  if (err.code) console.error("Twilio code:", err.code);
  process.exit(1);
});
