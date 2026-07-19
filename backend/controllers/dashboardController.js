const History = require("../model/History");
const BlacklistAlert = require("../model/BlacklistAlert");
const BlacklistItem = require("../model/BlacklistItem");
const InvestigationCase = require("../model/InvestigationCase");
const User = require("../model/user");
const { migrateResolvedCases } = require("../utils/migrateResolvedCases");

const dayKey = (date) => date.toISOString().slice(0, 10);

const STATUS_LABELS = {
  pending: "Pending",
  investigating: "Investigating",
  crime_case: "Crime Case",
  not_crime: "Not Crime",
  archived: "Archived",
};

const getUniqueHistoryCount = async (filter = {}) => {
  const docs = await History.find(filter).select("_id postId").lean();

  const seen = new Set();

  docs.forEach((doc) => {
    seen.add(doc.postId || doc._id.toString());
  });

  return seen.size;
};

const getDashboardStats = async (req, res) => {
  try {
    // Fix old data so Resolved never appears as its own final status.
    await migrateResolvedCases();

    const [
      totalAnalysis,
      crimeDetected,
      totalUsers,
      investigatorUsers,
      blacklistTotal,
      facebookPages,
      activeCases,
      recentHistory,
      recentInvestigations,
    ] = await Promise.all([
      getUniqueHistoryCount({}),
      getUniqueHistoryCount({ isCrime: true }),
      User.countDocuments(),
      User.countDocuments({ role: "investigator" }),
      BlacklistItem.countDocuments({ active: true }),
      BlacklistItem.countDocuments({ type: "facebook_page", active: true }),
      InvestigationCase.countDocuments({
        status: { $in: ["pending", "investigating"] },
      }),
      History.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      InvestigationCase.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("history"),
    ]);

    const safeContent = Math.max(totalAnalysis - crimeDetected, 0);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const historyTrend = await History.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            uniqueKey: { $ifNull: ["$postId", { $toString: "$_id" }] },
            day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            isCrime: "$isCrime",
          },
        },
      },
      {
        $group: {
          _id: {
            day: "$_id.day",
            isCrime: "$_id.isCrime",
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.day": 1 } },
    ]);

    const trendMap = {};

    for (let i = 0; i < 7; i += 1) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      trendMap[dayKey(date)] = {
        day: date.toLocaleDateString("en-US", { weekday: "short" }),
        crime: 0,
        safe: 0,
      };
    }

    historyTrend.forEach((item) => {
      const key = item._id.day;
      if (!trendMap[key]) return;

      if (item._id.isCrime) trendMap[key].crime = item.count;
      else trendMap[key].safe = item.count;
    });

    const [
      analysisTypes,
      caseStatus,
      facebookMonitoring,
      topKeywords,
      blacklistCrimeChart,
    ] = await Promise.all([
      History.aggregate([
        {
          $group: {
            _id: {
              uniqueKey: { $ifNull: ["$postId", { $toString: "$_id" }] },
              type: "$type",
            },
          },
        },
        {
          $group: {
            _id: "$_id.type",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      InvestigationCase.aggregate([
        {
          $match: {
            status: {
              $in: ["pending", "investigating", "crime_case", "not_crime", "archived"],
            },
          },
        },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      BlacklistItem.aggregate([
        { $match: { type: "facebook_page" } },
        { $group: { _id: "$lastScanStatus", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      History.aggregate([
        { $match: { matchedKeyword: { $nin: [null, ""] } } },
        {
          $group: {
            _id: {
              uniqueKey: { $ifNull: ["$postId", { $toString: "$_id" }] },
              keyword: "$matchedKeyword",
            },
          },
        },
        {
          $group: {
            _id: "$_id.keyword",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      BlacklistAlert.aggregate([
        { $match: { history: { $ne: null } } },
        {
          $group: {
            _id: {
              item: "$blacklistItem",
              matchedValue: "$matchedValue",
              sourceType: "$sourceType",
              postId: "$postId",
            },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: {
              item: "$_id.item",
              matchedValue: "$_id.matchedValue",
              sourceType: "$_id.sourceType",
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 8 },
        {
          $lookup: {
            from: "blacklistitems",
            localField: "_id.item",
            foreignField: "_id",
            as: "item",
          },
        },
        { $unwind: { path: "$item", preserveNullAndEmptyArrays: true } },
      ]),
    ]);

    res.json({
      stats: {
        totalAnalysis,
        crimeDetected,
        safeContent,
        totalUsers,
        investigatorUsers,
        blacklistTotal,
        facebookPages,
        activeCases,
      },

      trend: Object.values(trendMap),

      classificationDistribution: [
        { name: "Crime", value: crimeDetected },
        { name: "Not Crime", value: safeContent },
      ],

      analysisTypes: analysisTypes.map((item) => ({
        type: item._id || "unknown",
        count: item.count,
      })),

      caseStatus: caseStatus.map((item) => ({
        status: STATUS_LABELS[item._id] || item._id || "Unknown",
        key: item._id || "unknown",
        count: item.count,
      })),

      facebookMonitoring: facebookMonitoring.map((item) => ({
        status: item._id || "not_scanned",
        count: item.count,
      })),

      topKeywords: topKeywords.map((item) => ({
        keyword: item._id,
        count: item.count,
      })),

      blacklistCrimeChart: blacklistCrimeChart.map((item) => ({
        name: item.item?.name || item._id.matchedValue || "Blacklist item",
        matchedValue: item._id.matchedValue,
        type: item.item?.type || item._id.sourceType,
        count: item.count,
      })),

      recentAlerts: recentHistory.map((item) => ({
        id: item._id,
        type: item.type,
        sourceType: item.sourceType,
        content: item.content,
        url: item.url,
        postId: item.postId,
        authorName: item.authorName,
        pageName: item.pageName,
        prediction: item.prediction,
        isCrime: item.isCrime,
        confidence: item.confidence,
        matchedKeyword: item.matchedKeyword,
        location: item.location || [],
        blacklistMatches: item.blacklistMatches || [],
        createdAt: item.createdAt,
      })),

      recentInvestigations: recentInvestigations.map((item) => ({
        id: item._id,
        status: item.status,
        content: item.history?.content,
        title: `${item.history?.type || "Crime"} case`,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    console.error("DASHBOARD ERROR:", error);

    res.status(500).json({
      message: "Failed to load dashboard stats",
      error: error.message,
    });
  }
};

module.exports = {
  getDashboardStats,
};
