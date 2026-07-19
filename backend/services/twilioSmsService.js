const twilio = require("twilio");
const { normalizePhone } = require("./twilioVerifyService");
const { buildCaseAssignmentSms } = require("./caseAssignmentNotifications");

const isConfigured = () =>
  Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      (process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID)
  );

const getClient = () => {
  if (!isConfigured()) {
    throw new Error("Twilio SMS is not configured");
  }

  return twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
};

const sendSms = async ({ to, body }) => {
  const client = getClient();
  const normalizedTo = normalizePhone(to);

  const payload = {
    to: normalizedTo,
    body: String(body).trim(),
  };

  if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    payload.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  } else {
    payload.from = normalizePhone(process.env.TWILIO_PHONE_NUMBER);
  }

  const message = await client.messages.create(payload);
  return { sid: message.sid, status: message.status, to: normalizedTo };
};

const buildCaseAssignmentMessage = (investigationCase, officer = {}) =>
  buildCaseAssignmentSms(investigationCase, officer);

const formatSmsError = (error) => {
  const code = error?.code;
  const message = error?.message || "SMS send failed";

  if (code === 63038 || message.toLowerCase().includes("daily messages limit")) {
    return "Twilio trial daily SMS limit reached (5/day). Upgrade account or try again tomorrow.";
  }

  if (code === 21660) {
    return "TWILIO_PHONE_NUMBER does not belong to your Twilio account.";
  }

  if (code === 21608 || message.toLowerCase().includes("unverified")) {
    return "Recipient phone is not verified on your Twilio trial account.";
  }

  return message;
};

const sendCaseAssignmentSms = async ({ officer, investigationCase }) => {
  if (!isConfigured()) {
    console.warn("CASE ASSIGNMENT SMS skipped: Twilio SMS not configured (TWILIO_PHONE_NUMBER)");
    return null;
  }

  if (!officer?.phone?.trim()) {
    console.warn(
      `CASE ASSIGNMENT SMS skipped: investigator ${officer?.name || officer?._id || "unknown"} has no phone number`
    );
    return null;
  }

  try {
    const body = buildCaseAssignmentMessage(investigationCase, officer);
    const result = await sendSms({ to: officer.phone, body });
    console.log(`CASE ASSIGNMENT SMS sent to ${result.to} (${result.status})`);
    return result;
  } catch (error) {
    console.error("CASE ASSIGNMENT SMS ERROR:", formatSmsError(error), `(code ${error.code || "n/a"})`);
    throw error;
  }
};

module.exports = {
  isConfigured,
  sendSms,
  formatSmsError,
  sendCaseAssignmentSms,
  buildCaseAssignmentMessage,
};
