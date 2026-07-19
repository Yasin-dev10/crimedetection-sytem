const mongoose = require("mongoose");

const BlacklistItem = require("../model/BlacklistItem");
const History = require("../model/History");
const InvestigationCase = require("../model/InvestigationCase");
const User = require("../model/user");

const CONTENT_SNIPPET_MAX = 300;
const DEFAULT_FAKE_CRIME_THRESHOLD = 3;

const clipContentSnippet = (value = "") => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= CONTENT_SNIPPET_MAX) return text;
  return `${text.slice(0, CONTENT_SNIPPET_MAX).trim()}...`;
};

const parseFakeCrimeThreshold = (raw) => {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_FAKE_CRIME_THRESHOLD;
  return Math.min(100, Math.max(1, parsed));
};

/**
 * Investigator-confirmed fake/not-crime reports per blacklist subject.
 *
 * Count source: InvestigationCase(status=not_crime, resolvedBy set) whose
 * resolver has role investigator (admin-only resolutions never count),
 * joined through History.blacklistMatches. Case/history IDs are counted
 * distinctly per blacklist item.
 *
 * Options:
 * - threshold: minimum fakeCount for a subject to qualify (full report mode).
 * - blacklistItemId: when set, restricts the report to that single blacklist
 *   item and ignores the threshold for inclusion, so its evidence can be
 *   exported even below the threshold.
 *
 * Returns subjects sorted by fakeCount desc, then latest occurrence desc,
 * each with evidence sorted newest first and content clipped to 300 chars.
 */
const buildFakeCrimeSubjects = async ({
  threshold = DEFAULT_FAKE_CRIME_THRESHOLD,
  blacklistItemId = null,
} = {}) => {
  const itemMatch = blacklistItemId
    ? new mongoose.Types.ObjectId(String(blacklistItemId))
    : { $ne: null };

  const minCount = blacklistItemId ? 1 : threshold;

  const rows = await InvestigationCase.aggregate([
    {
      $match: {
        status: "not_crime",
        resolvedBy: { $ne: null },
      },
    },
    {
      $lookup: {
        from: User.collection.name,
        localField: "resolvedBy",
        foreignField: "_id",
        as: "resolver",
      },
    },
    { $unwind: "$resolver" },
    {
      $match: {
        "resolver.role": "investigator",
      },
    },
    {
      $lookup: {
        from: History.collection.name,
        localField: "history",
        foreignField: "_id",
        as: "historyDoc",
      },
    },
    { $unwind: "$historyDoc" },
    {
      $unwind: {
        path: "$historyDoc.blacklistMatches",
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $match: {
        "historyDoc.blacklistMatches.item": itemMatch,
      },
    },
    {
      $addFields: {
        occurrenceAt: {
          $ifNull: ["$resolvedAt", "$updatedAt"],
        },
      },
    },
    // One history may list the same blacklist item more than once — dedupe.
    {
      $group: {
        _id: {
          item: "$historyDoc.blacklistMatches.item",
          historyId: "$historyDoc._id",
          caseId: "$_id",
        },
        content: { $first: "$historyDoc.content" },
        url: { $first: "$historyDoc.url" },
        sourceType: { $first: "$historyDoc.sourceType" },
        authorName: { $first: "$historyDoc.authorName" },
        pageName: { $first: "$historyDoc.pageName" },
        createdAt: { $first: "$historyDoc.createdAt" },
        resolvedAt: { $first: "$occurrenceAt" },
        resolvedBy: {
          $first: {
            _id: "$resolver._id",
            name: "$resolver.name",
            email: "$resolver.email",
            badgeNumber: "$resolver.badgeNumber",
          },
        },
      },
    },
    {
      $group: {
        _id: "$_id.item",
        fakeCount: { $sum: 1 },
        latestOccurrenceAt: { $max: "$resolvedAt" },
        evidence: {
          $push: {
            caseId: "$_id.caseId",
            historyId: "$_id.historyId",
            content: "$content",
            url: "$url",
            sourceType: "$sourceType",
            authorName: "$authorName",
            pageName: "$pageName",
            resolvedAt: "$resolvedAt",
            resolvedBy: "$resolvedBy",
            createdAt: "$createdAt",
          },
        },
      },
    },
    {
      $match: {
        fakeCount: { $gte: minCount },
      },
    },
    {
      $lookup: {
        from: BlacklistItem.collection.name,
        localField: "_id",
        foreignField: "_id",
        as: "item",
      },
    },
    { $unwind: "$item" },
    {
      $project: {
        _id: 0,
        item: {
          _id: "$item._id",
          name: "$item.name",
          type: "$item.type",
          value: "$item.value",
          reason: "$item.reason",
          priority: "$item.priority",
          active: "$item.active",
          monitorEnabled: "$item.monitorEnabled",
        },
        fakeCount: 1,
        latestOccurrenceAt: 1,
        evidence: 1,
      },
    },
    {
      $sort: {
        fakeCount: -1,
        latestOccurrenceAt: -1,
      },
    },
  ]);

  return rows.map((row) => {
    const evidence = (row.evidence || [])
      .map((entry) => ({
        caseId: entry.caseId,
        historyId: entry.historyId,
        content: clipContentSnippet(entry.content),
        url: entry.url || null,
        sourceType: entry.sourceType || null,
        authorName: entry.authorName || null,
        pageName: entry.pageName || null,
        resolvedAt: entry.resolvedAt || null,
        resolvedBy: entry.resolvedBy || null,
        createdAt: entry.createdAt || null,
      }))
      .sort((a, b) => {
        const aTime = new Date(a.resolvedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.resolvedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });

    return {
      item: row.item,
      fakeCount: row.fakeCount,
      latestOccurrenceAt: row.latestOccurrenceAt || null,
      evidence,
    };
  });
};

module.exports = {
  DEFAULT_FAKE_CRIME_THRESHOLD,
  parseFakeCrimeThreshold,
  clipContentSnippet,
  buildFakeCrimeSubjects,
};
