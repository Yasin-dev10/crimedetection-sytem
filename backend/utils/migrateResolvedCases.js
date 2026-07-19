const History = require("../model/History");
const InvestigationCase = require("../model/InvestigationCase");

/**
 * Legacy "resolved" cases must become Crime Case or Not Crime.
 */
const migrateResolvedCases = async () => {
  const resolvedCases = await InvestigationCase.find({ status: "resolved" })
    .populate("history", "isCrime")
    .select("history status");

  if (!resolvedCases.length) return 0;

  await Promise.all(
    resolvedCases.map(async (item) => {
      const isCrime = item.history?.isCrime === true;
      const nextStatus = isCrime ? "crime_case" : "not_crime";

      await InvestigationCase.updateOne(
        { _id: item._id },
        { $set: { status: nextStatus } }
      );

      const historyId = item.history?._id || item.history;
      if (!historyId) return;

      await History.updateOne(
        { _id: historyId },
        {
          $set: {
            investigationStatus: nextStatus,
            isCrime,
            prediction: isCrime ? "CRIME-RELATED" : "not crime-related",
          },
        }
      );
    })
  );

  return resolvedCases.length;
};

module.exports = {
  migrateResolvedCases,
};
