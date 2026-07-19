const crypto = require("crypto");
const BlacklistAlert = require("../model/BlacklistAlert");
const User = require("../model/user");
const { sendEmailAlert } = require("./emailService");

const normalizeContent = (value = "") =>
  String(value).toLowerCase().replace(/\s+/g, " ").trim();

const normalizeAlertContent = (value = "") =>
  normalizeContent(value)
    .replace(
      /\b\d+\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\b/g,
      ""
    )
    .replace(/[·•]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toDayKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const fingerprint = (value = "") =>
  crypto
    .createHash("sha256")
    .update(normalizeAlertContent(value))
    .digest("hex");

const sendCrimeAlertEmails = async ({ matchedValue, sourceType, priority, content }) => {
  try {
    const admins = await User.find({
      role: "admin",
      emailAlerts: true,
      email: { $nin: [null, ""] },
    });

    await Promise.all(
      admins.map((admin) =>
        sendEmailAlert({
          to: admin.email,
          subject: "🚨 BAAREAI Crime Alert Detected",
          message: `
            <h2>BAAREAI Crime Alert</h2>
            <p><b>Crime-related content detected.</b></p>
            <p><b>Matched:</b> ${matchedValue || "N/A"}</p>
            <p><b>Source:</b> ${sourceType || "facebook"}</p>
            <p><b>Priority:</b> ${priority || "high"}</p>
            <p><b>Content:</b></p>
            <p>${String(content || "").slice(0, 1000)}</p>
          `,
        })
      )
    );
  } catch (error) {
    console.error("CRIME ALERT EMAIL ERROR:", error.message);
  }
};

const createDailyBlacklistAlert = async ({
  blacklistItem,
  history = null,
  sourceType = "facebook",
  content,
  matchedValue,
  priority = "high",
  status = "new",
  postId = null,
  dedupeContent = content,
}) => {
  const dayKey = toDayKey();

  const cleanDedupeContent = normalizeAlertContent(
    dedupeContent || content || matchedValue
  );

  const contentFingerprint = fingerprint(cleanDedupeContent);
  const blacklistItemId = blacklistItem?._id || blacklistItem;

  console.log("CHECKING ALERT:", {
    blacklistItem: blacklistItemId,
    matchedValue,
    postId,
    dayKey,
  });

  const existingAlert = await BlacklistAlert.findOne({
    blacklistItem: blacklistItemId,
    $or: [{ contentFingerprint, dayKey }, ...(postId ? [{ postId }] : [])],
  });

  if (existingAlert) {
    console.log("DUPLICATE ALERT BLOCKED");

    return {
      alert: existingAlert,
      created: false,
    };
  }

  const alert = await BlacklistAlert.create({
    blacklistItem: blacklistItemId,
    history,
    sourceType,
    content,
    matchedValue,
    priority,
    status,
    postId,
    contentFingerprint,
    dayKey,
  });

  console.log("NEW ALERT CREATED");

  await sendCrimeAlertEmails({
    matchedValue,
    sourceType,
    priority,
    content,
  });

  return {
    alert,
    created: true,
  };
};

module.exports = {
  createDailyBlacklistAlert,
  fingerprint,
  normalizeAlertContent,
  normalizeContent,
  toDayKey,
};