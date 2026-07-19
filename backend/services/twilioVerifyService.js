const twilio = require("twilio");

const isConfigured = () =>
  Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_VERIFY_SERVICE_SID
  );

const getClient = () => {
  if (!isConfigured()) {
    throw new Error("Twilio Verify is not configured");
  }

  return twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
};

const DEFAULT_COUNTRY_CODE = process.env.TWILIO_DEFAULT_COUNTRY_CODE || "252";

const normalizePhone = (phone) => {
  const trimmed = String(phone || "").trim();
  let digits = trimmed.replace(/\D/g, "");

  if (!digits) {
    throw new Error("Phone number is required");
  }

  if (trimmed.startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.startsWith(DEFAULT_COUNTRY_CODE) && digits.length > DEFAULT_COUNTRY_CODE.length + 6) {
    return `+${digits}`;
  }

  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.length === 10 && /^[2-9]/.test(digits)) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // Somalia mobile: 9 digits, usually starts with 6 or 7
  if (digits.length === 9 && /^[67]/.test(digits)) {
    return `+${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  if (digits.length >= 7 && digits.length <= 10) {
    return `+${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  return `+${digits}`;
};

const formatPhoneError = (error) => {
  const message = error?.message || "";

  if (message.includes("Invalid parameter `To`")) {
    return "Invalid phone number. Use international format, e.g. +252615588696 or 0615588696.";
  }

  if (message.includes("not a valid phone number")) {
    return "Invalid phone number. Use international format, e.g. +252615588696.";
  }

  if (message.includes("21608") || message.toLowerCase().includes("unverified")) {
    return "This number is not verified on your Twilio trial account. Verify it in Twilio Console first.";
  }

  return message || "Could not send SMS verification code.";
};

const sendVerification = async (phone) => {
  const client = getClient();
  const to = normalizePhone(phone);

  const verification = await client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
    .verifications.create({ to, channel: "sms" });

  return { status: verification.status, to };
};

const checkVerification = async (phone, code) => {
  const client = getClient();
  const to = normalizePhone(phone);

  const check = await client.verify.v2
    .services(process.env.TWILIO_VERIFY_SERVICE_SID)
    .verificationChecks.create({ to, code: String(code).trim() });

  return check.status === "approved";
};

module.exports = {
  isConfigured,
  normalizePhone,
  formatPhoneError,
  sendVerification,
  checkVerification,
};
