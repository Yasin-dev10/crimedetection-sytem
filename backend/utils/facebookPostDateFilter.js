const PERIOD_DAYS = Object.freeze({
  week: 7,
  month: 30,
  year: 365,
});

const buildFacebookPostDateFilter = (query = {}, now = new Date()) => {
  const rawPeriod = String(query.period || "").trim().toLowerCase();

  if (rawPeriod) {
    const days = PERIOD_DAYS[rawPeriod];
    if (!days) {
      const error = new Error("Period must be week, month, or year.");
      error.status = 400;
      throw error;
    }

    const end = new Date(now);
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    return { publishedAt: { $gte: start, $lte: end } };
  }

  // Keep the existing calendar filters working for bookmarked URLs.
  const rawYear = String(query.year || "").trim();
  const rawMonth = String(query.month || "").trim();
  if (!rawYear && !rawMonth) return {};

  const year = Number.parseInt(rawYear, 10);
  const month = rawMonth ? Number.parseInt(rawMonth, 10) : null;
  const currentYear = now.getFullYear();

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

  return { publishedAt: { $gte: start, $lte: end } };
};

module.exports = { buildFacebookPostDateFilter, PERIOD_DAYS };
