const test = require("node:test");
const assert = require("node:assert/strict");
const { buildFacebookPostDateFilter } = require("./facebookPostDateFilter");

const NOW = new Date("2026-08-09T12:00:00.000Z");

for (const [period, days] of [["week", 7], ["month", 30], ["year", 365]]) {
  test(`${period} filters by the rolling published date range`, () => {
    const filter = buildFacebookPostDateFilter({ period }, NOW);
    assert.deepEqual(filter, {
      publishedAt: {
        $gte: new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000),
        $lte: NOW,
      },
    });
  });
}

test("no period returns every post", () => {
  assert.deepEqual(buildFacebookPostDateFilter({}, NOW), {});
});

test("an unsupported period is rejected", () => {
  assert.throws(
    () => buildFacebookPostDateFilter({ period: "quarter" }, NOW),
    { message: "Period must be week, month, or year.", status: 400 }
  );
});
