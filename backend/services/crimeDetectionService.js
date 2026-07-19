const History = require("../model/History");
const InvestigationCase = require("../model/InvestigationCase");
const Notification = require("../model/Notification");
const User = require("../model/user");
const BlacklistAlert = require("../model/BlacklistAlert");
const { sendEmailAlert } = require("./emailService");

const CASE_CATEGORIES = [
  "murder",
  "robbery",
  "terrorism",
  "sexual_assault",
  "financial_fraud",
  "drug_crimes",
  "cybercrime",
  "general",
];

const CATEGORY_KEYWORDS = {
  murder: ["dil", "diley", "dilay", "laayay", "toogasho", "murder", "killing"],
  robbery: ["dhac", "xatooyo", "boob", "lacag", "robbery", "theft"],
  terrorism: ["argagixiso", "qarax", "al-shabaab", "terror", "bomb"],
  sexual_assault: ["kufsi", "faraxumeyn", "sexual", "rape"],
  financial_fraud: ["fraud", "scam", "lacag", "khiyaano", "maaliyad"],
  drug_crimes: ["daroogo", "maandooriye", "drug", "narcotic"],
  cybercrime: ["cyber", "hack", "hacking", "online", "computer", "kumbiyuutar"],
};

const inferCaseCategory = (history = {}) => {
  const text = [
    history.content,
    history.matchedKeyword,
    history.prediction,
    ...(history.blacklistMatches || []).map(
      (match) => `${match.type} ${match.value}`
    ),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => text.includes(keyword))) {
      return category;
    }
  }

  return "general";
};

const previewContent = (history = {}) =>
  String(history.content || history.extractedText || "Crime-related content")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

/**
 * When AI (or blacklist) marks content as crime:
 * 1. Notify all admins first
 * 2. Open a pending investigation case
 * 3. Broadcast the case to every active investigator
 */
const dispatchCrimeDetection = async ({ history }) => {
  if (!history?._id || !history.isCrime) {
    return { skipped: true, reason: "not_crime" };
  }

  const historyId = history._id;

  let investigationCase = await InvestigationCase.findOne({ history: historyId });

  if (!investigationCase) {
    try {
      investigationCase = await InvestigationCase.create({
        history: historyId,
        category: CASE_CATEGORIES.includes(history.category)
          ? history.category
          : inferCaseCategory(history),
        status: "pending",
        assignedOfficer: null,
      });
    } catch (error) {
      // Unique history index — another request created the case first
      if (error?.code === 11000) {
        investigationCase = await InvestigationCase.findOne({ history: historyId });
      } else {
        throw error;
      }
    }
  }

  if (!investigationCase) {
    return { skipped: true, reason: "case_missing" };
  }

  // Already claimed — do not rebroadcast
  if (investigationCase.assignedOfficer) {
    return {
      skipped: true,
      reason: "already_assigned",
      case: investigationCase,
    };
  }

  await History.findByIdAndUpdate(historyId, {
    investigationStatus: "sent_to_investigation",
  });

  await BlacklistAlert.updateMany(
    { history: historyId },
    { status: "sent_to_investigation" }
  );

  // Idempotent: only one broadcast wave per case
  const alreadyBroadcast = await Notification.exists({
    case: investigationCase._id,
    type: { $in: ["crime_detected", "case_available"] },
  });

  if (alreadyBroadcast) {
    return {
      skipped: true,
      reason: "already_broadcast",
      case: investigationCase,
    };
  }

  const admins = await User.find({
    role: "admin",
    status: { $ne: "inactive" },
  }).select("_id name email emailAlerts");

  const investigators = await User.find({
    role: "investigator",
    status: { $ne: "inactive" },
  }).select("_id name email emailAlerts");

  const contentPreview = previewContent(history);
  const category = investigationCase.category || "general";

  // Admin notifications — visibility only; investigators get the claim queue
  if (admins.length > 0) {
    await Notification.insertMany(
      admins.map((admin) => ({
        recipient: admin._id,
        case: investigationCase._id,
        type: "crime_detected",
        title: "Crime detected by AI",
        message: `AI flagged crime-related content (${category}). Case was sent to all investigators — first to open claims it. Preview: ${contentPreview}`,
        read: false,
        active: true,
      }))
    );

    await Promise.all(
      admins
        .filter((admin) => admin.emailAlerts !== false && admin.email)
        .map((admin) =>
          sendEmailAlert({
            to: admin.email,
            subject: "BAREAI — Crime Detected",
            message: `
              <h2>Crime Detected by AI</h2>
              <p>A new crime-related analysis result was broadcast to all investigators.</p>
              <p><b>Category:</b> ${category}</p>
              <p><b>Status:</b> Waiting for the first investigator to open and claim the case.</p>
              <p><b>Preview:</b></p>
              <p>${contentPreview}</p>
            `,
          }).catch((err) =>
            console.error("ADMIN CRIME EMAIL ERROR:", err.message)
          )
        )
    );
  }

  // Broadcast to every investigator at the same time
  if (investigators.length > 0) {
    await Notification.insertMany(
      investigators.map((officer) => ({
        recipient: officer._id,
        case: investigationCase._id,
        type: "case_available",
        title: "New crime case available",
        message: `AI detected a crime case (${category}). Open it first to claim and investigate. Preview: ${contentPreview}`,
        read: false,
        active: true,
      }))
    );

    await Promise.all(
      investigators
        .filter((officer) => officer.emailAlerts !== false && officer.email)
        .map((officer) =>
          sendEmailAlert({
            to: officer.email,
            subject: "BAREAI — New Crime Case Available",
            message: `
              <h2>New Crime Case Available</h2>
              <p>AI detected crime-related content. Open the case in Case Management to claim it.</p>
              <p><b>Rule:</b> The first investigator to open the case becomes the assigned officer. Others are removed automatically.</p>
              <p><b>Preview:</b></p>
              <p>${contentPreview}</p>
            `,
          }).catch((err) =>
            console.error("INVESTIGATOR CRIME EMAIL ERROR:", err.message)
          )
        )
    );
  }

  return {
    skipped: false,
    case: investigationCase,
    adminCount: admins.length,
    investigatorCount: investigators.length,
  };
};

/**
 * First investigator to open/claim wins the case.
 * Removes the case from every other investigator's queue.
 */
const acceptCaseByInvestigator = async ({ caseId, investigator }) => {
  if (!investigator?._id) {
    const error = new Error("Investigator required");
    error.statusCode = 400;
    throw error;
  }

  const claimed = await InvestigationCase.findOneAndUpdate(
    {
      _id: caseId,
      assignedOfficer: null,
      status: "pending",
    },
    {
      $set: {
        assignedOfficer: investigator._id,
        status: "investigating",
        assignedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!claimed) {
    const existing = await InvestigationCase.findById(caseId).populate(
      "assignedOfficer",
      "name email role"
    );

    if (!existing) {
      const error = new Error("Case not found");
      error.statusCode = 404;
      throw error;
    }

    if (
      existing.assignedOfficer &&
      existing.assignedOfficer._id.toString() === investigator._id.toString()
    ) {
      return { case: existing, alreadyMine: true };
    }

    const error = new Error(
      existing.assignedOfficer
        ? `Case already claimed by ${existing.assignedOfficer.name || "another investigator"}`
        : "Case is no longer available"
    );
    error.statusCode = 409;
    error.assignedOfficer = existing.assignedOfficer;
    throw error;
  }

  await History.findByIdAndUpdate(claimed.history, {
    investigationStatus: "under_review",
  });

  // Remove from every other investigator's queue
  await Notification.updateMany(
    {
      case: claimed._id,
      type: "case_available",
      recipient: { $ne: investigator._id },
      active: true,
    },
    {
      $set: {
        active: false,
        type: "case_taken",
        read: true,
        title: "Case claimed by another investigator",
        message: `${investigator.name || "Another investigator"} opened this case first. It has been removed from your list.`,
      },
    }
  );

  // Winner: convert available → assigned
  await Notification.findOneAndUpdate(
    {
      case: claimed._id,
      recipient: investigator._id,
      type: "case_available",
    },
    {
      $set: {
        type: "case_assigned",
        title: "Case assigned to you",
        message:
          "You opened this case first and are now the assigned investigator.",
        read: false,
        active: true,
      },
    },
    { upsert: false }
  );

  // Inform admins who claimed
  const admins = await User.find({
    role: "admin",
    status: { $ne: "inactive" },
  }).select("_id");

  if (admins.length > 0) {
    await Notification.insertMany(
      admins.map((admin) => ({
        recipient: admin._id,
        case: claimed._id,
        type: "case_updated",
        title: "Investigator claimed case",
        message: `${investigator.name || "An investigator"} opened the crime case first and is now assigned.`,
        read: false,
        active: true,
      }))
    );
  }

  return { case: claimed, alreadyMine: false };
};

/**
 * When an admin manually assigns an officer, clear the shared claim queue.
 */
const clearCaseAvailableQueue = async (caseId, keepRecipientId = null) => {
  const filter = {
    case: caseId,
    type: "case_available",
    active: true,
  };

  if (keepRecipientId) {
    filter.recipient = { $ne: keepRecipientId };
  }

  await Notification.updateMany(filter, {
    $set: {
      active: false,
      type: "case_taken",
      read: true,
      title: "Case assigned by admin",
      message:
        "An admin assigned this case to an investigator. It has been removed from your queue.",
    },
  });
};

module.exports = {
  dispatchCrimeDetection,
  acceptCaseByInvestigator,
  clearCaseAvailableQueue,
  inferCaseCategory,
};
