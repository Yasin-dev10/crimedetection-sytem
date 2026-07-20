const BlacklistAlert = require("../model/BlacklistAlert");
const BlacklistItem = require("../model/BlacklistItem");
const History = require("../model/History");
const InvestigationCase = require("../model/InvestigationCase");
const User = require("../model/user");
const axios = require("axios");
const cheerio = require("cheerio");

const {
  scanFacebookItem,
  scanFacebookWatchlist,
} = require("../services/facebookMonitor");

const {
  scanWebsiteItem,
  scanWebsiteWatchlist,
  validateWebsiteUrlValue,
} = require("../services/websiteMonitor");

const {
  normalizeAlertContent,
  toDayKey,
} = require("../services/blacklistAlertService");

const {
  parseFakeCrimeThreshold,
  buildFakeCrimeSubjects,
} = require("../services/fakeCrimeReportService");
const { logActivity } = require("../utils/activityLogger");

const normalizeBlacklistValue = (value = "") =>
  String(value).trim().replace(/\/+$/, "").toLowerCase();

const normalizeWebsiteValue = (value = "") => {
  const parsed = new URL(String(value).trim());
  parsed.hash = "";

  // URL normalizes protocol/hostname casing while preserving case-sensitive
  // paths and query values.
  if (parsed.pathname === "/" && !parsed.search) {
    return `${parsed.protocol}//${parsed.host}`;
  }

  return parsed.toString();
};

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isUrl = (value = "") => /^https?:\/\//i.test(String(value).trim());

const buildScanDateFilter = (query = {}) => {
  const rawYear = String(query.year || "").trim();
  const rawMonth = String(query.month || "").trim();
  if (!rawYear && !rawMonth) return {};

  const year = Number.parseInt(rawYear, 10);
  const month = rawMonth ? Number.parseInt(rawMonth, 10) : null;
  const currentYear = new Date().getFullYear();

  if (!Number.isInteger(year) || year < 2000 || year > currentYear) {
    const error = new Error(`Year must be between 2000 and ${currentYear}.`);
    error.status = 400;
    throw error;
  }
  if (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) {
    const error = new Error("Month must be between 1 and 12.");
    error.status = 400;
    throw error;
  }

  const start = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
  const end = month
    ? new Date(year, month, 0, 23, 59, 59, 999)
    : new Date(year, 11, 31, 23, 59, 59, 999);

  return { createdAt: { $gte: start, $lte: end } };
};

const cleanProfileName = (value = "") =>
  String(value)
    .replace(/\s*\|\s*Facebook\s*$/i, "")
    .replace(/\s*-\s*Facebook\s*$/i, "")
    .replace(/^Facebook\s*-\s*/i, "")
    .replace(/\(\d+\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

const getNameFromFacebookUrl = (url = "") => {
  try {
    const parsed = new URL(url);
    const slug = parsed.pathname
      .split("/")
      .filter(Boolean)
      .find((part) => !["profile.php", "pages", "groups", "people"].includes(part));

    if (!slug) return "";

    return decodeURIComponent(slug)
      .replace(/[-_.]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
  } catch {
    return "";
  }
};

const fetchFacebookProfileName = async (url) => {
  const response = await axios.get(url, {
    timeout: 12000,
    maxRedirects: 5,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  const $ = cheerio.load(response.data || "");
  const candidates = [
    $("meta[property='og:title']").attr("content"),
    $("meta[name='twitter:title']").attr("content"),
    $("title").text(),
    $("h1").first().text(),
  ];

  return candidates.map(cleanProfileName).find((name) => name && !/^facebook$/i.test(name));
};

const getBlacklistItems = async (req, res) => {
  try {
    const filter = {};

    if (req.query.type && req.query.type !== "all") {
      filter.type = req.query.type;
    }

    const items = await BlacklistItem.find(filter).sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch blacklist",
      error: error.message,
    });
  }
};

const resolveFacebookProfile = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || !isUrl(url)) {
      return res.status(400).json({
        message: "Valid Facebook Page URL is required",
      });
    }

    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

    if (!["facebook.com", "m.facebook.com", "fb.com"].includes(host)) {
      return res.status(400).json({
        message: "Only Facebook URLs are supported",
      });
    }

    const fetchedName = await fetchFacebookProfileName(url).catch(() => "");
    const fallbackName = getNameFromFacebookUrl(url);
    const name = fetchedName || fallbackName;

    if (!name) {
      return res.status(404).json({
        message: "Profile name could not be found from this URL",
      });
    }

    res.json({
      name,
      source: fetchedName ? "page_metadata" : "url",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to resolve Facebook profile name",
      error: error.message,
    });
  }
};

const createBlacklistItem = async (req, res) => {
  try {
    const { type, name, value, reason } = req.body;

    if (!type || !name || !value) {
      return res.status(400).json({
        message: "Type, name and value are required",
      });
    }

    if (type === "website") {
      const websiteCheck = validateWebsiteUrlValue(value);

      if (!websiteCheck.ok) {
        return res.status(400).json({ message: websiteCheck.message });
      }
    }

    const normalizedValue =
      type === "website"
        ? normalizeWebsiteValue(value)
        : normalizeBlacklistValue(value);

    const existing = await BlacklistItem.findOne({
      type,
      value: normalizedValue,
    });

    if (existing) {
      return res.status(409).json({
        message: "Blacklist item-kan hore ayuu system-ka ugu jiraa",
        item: existing,
      });
    }

    const item = await BlacklistItem.create({
      type,
      name,
      value: normalizedValue,
      reason,
      createdBy: req.user?._id,
    });

    await logActivity({
      req,
      action: "blacklist_entry_added",
      resourceType: "BlacklistItem",
      resourceId: item._id,
      details: {
        name: item.name,
        type: item.type,
        value: item.value,
      },
    });

    res.status(201).json({
      message: "Blacklist item created",
      item,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create blacklist item",
      error: error.message,
    });
  }
};

const updateBlacklistItem = async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.priority;

    const current = await BlacklistItem.findById(req.params.id);

    if (!current) {
      return res.status(404).json({
        message: "Blacklist item not found",
      });
    }

    const effectiveType = updates.type || current.type;

    if (
      effectiveType === "website" &&
      (updates.type !== undefined || updates.value !== undefined)
    ) {
      const effectiveValue =
        updates.value !== undefined ? updates.value : current.value;

      const websiteCheck = validateWebsiteUrlValue(effectiveValue);

      if (!websiteCheck.ok) {
        return res.status(400).json({ message: websiteCheck.message });
      }
    }

    if (updates.value) {
      updates.value =
        effectiveType === "website"
          ? normalizeWebsiteValue(updates.value)
          : normalizeBlacklistValue(updates.value);

      const existing = await BlacklistItem.findOne({
        _id: { $ne: req.params.id },
        type: effectiveType,
        value: updates.value,
      });

      if (existing) {
        return res.status(409).json({
          message: "Blacklist item-kan hore ayuu system-ka ugu jiraa",
          item: existing,
        });
      }
    }

    const item = await BlacklistItem.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!item) {
      return res.status(404).json({
        message: "Blacklist item not found",
      });
    }

    await logActivity({
      req,
      action: "blacklist_entry_updated",
      resourceType: "BlacklistItem",
      resourceId: item._id,
      details: {
        name: item.name,
        type: item.type,
        value: item.value,
      },
    });

    res.json({
      message: "Blacklist item updated",
      item,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update blacklist item",
      error: error.message,
    });
  }
};

const deleteBlacklistItem = async (req, res) => {
  try {
    const item = await BlacklistItem.findByIdAndDelete(req.params.id);

    if (!item) {
      return res.status(404).json({
        message: "Blacklist item not found",
      });
    }

    await logActivity({
      req,
      action: "blacklist_entry_removed",
      resourceType: "BlacklistItem",
      resourceId: item._id,
      details: {
        name: item.name,
        type: item.type,
        value: item.value,
      },
    });

    res.json({
      message: "Blacklist item deleted",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete blacklist item",
      error: error.message,
    });
  }
};

const getBlacklistAlerts = async (req, res) => {
  try {
    const alerts = await BlacklistAlert.find()
      .populate("blacklistItem")
      .populate({
        path: "history",
        match: { isCrime: true },
      })
      .sort({ createdAt: -1 })
      .limit(300);

    const crimeAlerts = alerts.filter((alert) => alert.history);

    const seen = new Set();

    const uniqueAlerts = crimeAlerts.filter((alert) => {
      const itemId = alert.blacklistItem?._id || alert.blacklistItem || "";
      const dayKey = alert.dayKey || toDayKey(alert.createdAt);
      const contentKey =
        alert.contentFingerprint ||
        normalizeAlertContent(alert.content || alert.history?.content || "");

      const key = [
        itemId.toString(),
        alert.matchedValue || "",
        alert.sourceType || "",
        dayKey,
        contentKey,
      ].join("|");

      if (seen.has(key)) return false;

      seen.add(key);
      return true;
    });

    res.json(uniqueAlerts.slice(0, 100));
  } catch (error) {
    console.error("BLACKLIST ALERTS ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch blacklist alerts",
      error: error.message,
    });
  }
};

const getFacebookPagePosts = async (req, res) => {
  try {
    const item = await BlacklistItem.findOne({
      _id: req.params.id,
      type: "facebook_page",
    });

    if (!item) {
      return res.status(404).json({
        message: "Facebook blacklist item not found",
      });
    }

    const dateFilter = buildScanDateFilter(req.query);
    const posts = await History.find({
      "blacklistMatches.item": item._id,
      sourceType: "facebook",
      ...dateFilter,
    })
      .sort({ createdAt: -1 })
      .limit(200);

    const totalPosts = posts.length;
    const crimePosts = posts.filter((post) => post.isCrime).length;
    const safePosts = totalPosts - crimePosts;

    res.json({
      item,
      summary: {
        totalPosts,
        crimePosts,
        safePosts,
      },
      posts,
    });
  } catch (error) {
    console.error("FACEBOOK PAGE POSTS ERROR:", error);

    res.status(error.status || 500).json({
      message: "Failed to fetch Facebook page posts",
      error: error.message,
    });
  }
};

const getBlacklistItemDetails = async (req, res) => {
  try {
    const item = await BlacklistItem.findById(req.params.id)
      .populate("createdBy", "name email role badgeNumber station")
      .lean();

    if (!item) {
      return res.status(404).json({
        message: "Blacklist item not found",
      });
    }

    const itemValue = String(item.value || "").trim();
    const matchQuery = {
      $or: [
        { "blacklistMatches.item": item._id },
        { "blacklistMatches.value": itemValue },
      ],
    };

    if (itemValue) {
      matchQuery.$or.push({
        content: { $regex: escapeRegex(itemValue), $options: "i" },
      });
    }

    // Keep Analysis, Facebook and Website streams separate.
    if (item.type === "facebook_page") {
      matchQuery.sourceType = "facebook";
    } else if (item.type === "website") {
      matchQuery.sourceType = "website";
    } else {
      matchQuery.sourceType = { $nin: ["facebook", "website"] };
    }

    const histories = await History.find(matchQuery)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const alerts = await BlacklistAlert.find({ blacklistItem: item._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const relatedUrls = Array.from(
      new Set(
        [
          isUrl(item.value) ? item.value : null,
          ...histories.map((history) => history.url).filter(Boolean),
        ].filter(Boolean)
      )
    );

    const crimeCount = histories.filter((history) => history.isCrime === true).length;
    const notCrimeCount = histories.filter((history) => history.isCrime === false).length;
    const pendingCount = histories.filter(
      (history) => history.investigationStatus === "pending"
    ).length;
    const sentToInvestigationCount = histories.filter(
      (history) => history.investigationStatus === "sent_to_investigation"
    ).length;
    const crimeCaseCount = histories.filter(
      (history) => history.investigationStatus === "crime_case"
    ).length;

    res.json({
      item,
      relatedUrls,
      report: {
        totalMatches: histories.length,
        totalAlerts: alerts.length,
        crimeCount,
        notCrimeCount,
        pendingCount,
        sentToInvestigationCount,
        crimeCaseCount,
        latestMatchAt: histories[0]?.createdAt || null,
        latestAlertAt: alerts[0]?.createdAt || null,
      },
      histories,
      alerts,
    });
  } catch (error) {
    console.error("BLACKLIST ITEM DETAILS ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch blacklist item details",
      error: error.message,
    });
  }
};

const scanFacebookBlacklist = async (req, res) => {
  try {
    const results = await scanFacebookWatchlist();

    res.json({
      message: "Facebook watchlist scan completed",
      results,
    });
  } catch (error) {
    res.status(500).json({
      message: "Facebook scan failed",
      error: error.message,
    });
  }
};

const scanSingleFacebookBlacklist = async (req, res) => {
  try {
    const item = await BlacklistItem.findOne({
      _id: req.params.id,
      type: "facebook_page",
    });

    if (!item) {
      return res.status(404).json({
        message: "Facebook blacklist item not found",
      });
    }

    const result = await scanFacebookItem(item);

    res.json({
      message: "Facebook page scan completed",
      result,
    });
  } catch (error) {
    res.status(500).json({
      message: "Facebook page scan failed",
      error: error.message,
    });
  }
};

const scanWebsiteBlacklist = async (req, res) => {
  try {
    const results = await scanWebsiteWatchlist();

    res.json({
      message: "Website watchlist scan completed",
      results,
    });
  } catch (error) {
    res.status(500).json({
      message: "Website scan failed",
      error: error.message,
    });
  }
};

const scanSingleWebsiteBlacklist = async (req, res) => {
  try {
    const item = await BlacklistItem.findOne({
      _id: req.params.id,
      type: "website",
    });

    if (!item) {
      return res.status(404).json({
        message: "Website blacklist item not found",
      });
    }

    const result = await scanWebsiteItem(item);

    res.json({
      message: "Website scan completed",
      result,
    });
  } catch (error) {
    res.status(500).json({
      message: "Website scan failed",
      error: error.message,
    });
  }
};

const getWebsitePages = async (req, res) => {
  try {
    const item = await BlacklistItem.findOne({
      _id: req.params.id,
      type: "website",
    }).lean();

    if (!item) {
      return res.status(404).json({
        message: "Website blacklist item not found",
      });
    }

    const dateFilter = buildScanDateFilter(req.query);
    const pages = await History.find({
      "blacklistMatches.item": item._id,
      sourceType: "website",
      ...dateFilter,
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    // Link investigation cases opened from these histories, if any.
    const historyIds = pages.map((page) => page._id);
    const cases = historyIds.length
      ? await InvestigationCase.find({ history: { $in: historyIds } })
          .select("history status assignedOfficer")
          .lean()
      : [];

    const caseByHistory = new Map(
      cases.map((caseDoc) => [String(caseDoc.history), caseDoc])
    );

    const pagesWithCases = pages.map((page) => {
      const linkedCase = caseByHistory.get(String(page._id));

      return {
        ...page,
        caseId: linkedCase?._id || null,
        caseStatus: linkedCase?.status || null,
      };
    });

    const totalPages = pagesWithCases.length;
    const crimePages = pagesWithCases.filter((page) => page.isCrime).length;
    const safePages = totalPages - crimePages;

    res.json({
      item,
      summary: {
        totalPages,
        crimePages,
        safePages,
      },
      pages: pagesWithCases,
    });
  } catch (error) {
    console.error("WEBSITE PAGES ERROR:", error);

    res.status(error.status || 500).json({
      message: "Failed to fetch website pages",
      error: error.message,
    });
  }
};

/**
 * Investigator-confirmed fake/not-crime reports per blacklist subject.
 * Count source: InvestigationCase(status=not_crime, resolvedBy set) whose
 * resolver has role investigator, joined through History.blacklistMatches.
 * Distinct case/history IDs per blacklist item; threshold defaults to 3.
 */
const getFakeCrimeSubjects = async (req, res) => {
  try {
    const threshold = parseFakeCrimeThreshold(req.query.threshold);

    const subjects = await buildFakeCrimeSubjects({ threshold });

    const totalConfirmedFakeReports = subjects.reduce(
      (sum, subject) => sum + (subject.fakeCount || 0),
      0
    );

    res.json({
      threshold,
      summary: {
        subjects: subjects.length,
        totalConfirmedFakeReports,
      },
      subjects,
    });
  } catch (error) {
    console.error("FAKE CRIME SUBJECTS ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch fake crime subjects",
      error: error.message,
    });
  }
};

/**
 * Investigator false / misleading / malicious report flags for blacklist UI.
 */
const getReportFlags = async (req, res) => {
  try {
    const reviewStatus = String(req.query.reviewStatus || "all")
      .trim()
      .toLowerCase();
    const flagType = String(req.query.flagType || "all")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_");

    const filter = {
      "reportFlag.type": {
        $in: [
          "false_report",
          "misleading_information",
          "malicious_report",
        ],
      },
    };

    if (["pending", "confirmed", "rejected"].includes(reviewStatus)) {
      filter["reportFlag.reviewStatus"] = reviewStatus;
    }

    if (
      ["false_report", "misleading_information", "malicious_report"].includes(
        flagType
      )
    ) {
      filter["reportFlag.type"] = flagType;
    }

    const cases = await InvestigationCase.find(filter)
      .sort({ "reportFlag.flaggedAt": -1, updatedAt: -1 })
      .populate({
        path: "history",
        select:
          "content sourceType type url pageName authorName user prediction confidence investigationStatus createdAt",
        populate: {
          path: "user",
          select:
            "name email role false_report_count is_flagged flag_reason account_status",
        },
      })
      .populate("reportFlag.flaggedBy", "name email role")
      .populate("reportFlag.reviewedBy", "name email role")
      .populate(
        "reportFlag.reportingUser",
        "name email role false_report_count is_flagged account_status"
      )
      .populate("assignedOfficer", "name email role")
      .lean();

    const summary = {
      total: cases.length,
      pending: cases.filter((c) => c.reportFlag?.reviewStatus === "pending")
        .length,
      confirmed: cases.filter((c) => c.reportFlag?.reviewStatus === "confirmed")
        .length,
      rejected: cases.filter((c) => c.reportFlag?.reviewStatus === "rejected")
        .length,
      false_report: cases.filter((c) => c.reportFlag?.type === "false_report")
        .length,
      misleading_information: cases.filter(
        (c) => c.reportFlag?.type === "misleading_information"
      ).length,
      malicious_report: cases.filter(
        (c) => c.reportFlag?.type === "malicious_report"
      ).length,
    };

    res.json({ summary, flags: cases });
  } catch (error) {
    console.error("REPORT FLAGS ERROR:", error);
    res.status(500).json({
      message: "Failed to fetch report flags",
      error: error.message,
    });
  }
};

const getBlacklistStats = async (req, res) => {
  try {
    // Get all blacklist items
    const items = await BlacklistItem.find().sort({ createdAt: -1 });

    // Get all history records with blacklist matches
    const histories = await History.find({
      blacklistMatches: { $exists: true, $not: { $size: 0 } },
    });

    // Build statistics for each blacklist item
    const itemStats = [];

    for (const item of items) {
      // Find all histories that matched this blacklist item
      const matchedHistories = histories.filter((history) =>
        history.blacklistMatches.some((match) =>
          match.item?.toString() === item._id.toString()
        )
      );

      // Count by isCrime flag (AI prediction result)
      const crimeCount = matchedHistories.filter((h) => h.isCrime === true).length;
      const notCrimeCount = matchedHistories.filter((h) => h.isCrime === false).length;
      const pendingCount = matchedHistories.filter(
        (h) => h.investigationStatus === "pending"
      ).length;
      const sentToInvestigationCount = matchedHistories.filter(
        (h) => h.investigationStatus === "sent_to_investigation"
      ).length;

      const totalCount = matchedHistories.length;
      const crimePercentage =
        totalCount > 0 ? Math.round((crimeCount / totalCount) * 100) : 0;
      const notCrimePercentage =
        totalCount > 0 ? Math.round((notCrimeCount / totalCount) * 100) : 0;

      itemStats.push({
        _id: item._id,
        type: item.type,
        name: item.name,
        value: item.value,
        reason: item.reason,
        priority: item.priority,
        active: item.active,
        createdAt: item.createdAt,
        totalMatches: totalCount,
        crimeCount,
        notCrimeCount,
        pendingCount,
        sentToInvestigationCount,
        crimePercentage,
        notCrimePercentage,
        canBeRemoved:
          totalCount > 0 && notCrimeCount > crimeCount && notCrimeCount > 0,
      });
    }

    // Sort by total matches (descending)
    itemStats.sort((a, b) => b.totalMatches - a.totalMatches);

    // Get items that can be removed (more not-crime than crime)
    const removableItems = itemStats.filter((item) => item.canBeRemoved);

    // Full list for "Show all" (every blacklist item)
    const topItems = itemStats;

    res.json({
      summary: {
        totalBlacklistItems: items.length,
        totalMatches: itemStats.reduce((sum, item) => sum + item.totalMatches, 0),
        totalCrimeMatches: itemStats.reduce(
          (sum, item) => sum + item.crimeCount,
          0
        ),
        totalNotCrimeMatches: itemStats.reduce(
          (sum, item) => sum + item.notCrimeCount,
          0
        ),
        removableItemsCount: removableItems.length,
      },
      topItems,
      removableItems,
      allStats: itemStats,
    });
  } catch (error) {
    console.error("BLACKLIST STATS ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch blacklist statistics",
      error: error.message,
    });
  }
};

module.exports = {
  getBlacklistItems,
  resolveFacebookProfile,
  createBlacklistItem,
  updateBlacklistItem,
  deleteBlacklistItem,
  getBlacklistAlerts,
  getFacebookPagePosts,
  getBlacklistItemDetails,
  scanFacebookBlacklist,
  scanSingleFacebookBlacklist,
  scanWebsiteBlacklist,
  scanSingleWebsiteBlacklist,
  getWebsitePages,
  getFakeCrimeSubjects,
  getReportFlags,
  getBlacklistStats,
};
