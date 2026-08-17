const puppeteer = require("puppeteer");
const axios = require("axios");
const crypto = require("crypto");

const BlacklistAlert = require("../model/BlacklistAlert");
const BlacklistItem = require("../model/BlacklistItem");
const History = require("../model/History");
const { createDailyBlacklistAlert } = require("./blacklistAlertService");
const { dispatchCrimeDetection } = require("./crimeDetectionService");
const { appendIncomingDataset } = require("./datasetStore");
const { AI_MODEL_URL, aiModelRequestConfig } = require("../config/aiModel");
const { assertSomaliOnly } = require("../utils/somaliLanguage");

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const CRIME_KEYWORDS = [
  "dil", "dilka", "dilay", "dileen", "la dilay", "ladilay",
  "dilaa", "gacan ku dhiigle", "qisaas", "laayay",
  "dhaawac", "dhaawacay", "dhaawacmay", "la dhaawacay",
  "dhaawac culus", "dhaawacyo",
  "toogasho", "toogtay", "la toogtay", "rasaas",
  "xabad", "xabbad", "furay rasaas",
  "weerar", "werar", "weeraray", "weerarkii",
  "weeraro", "weerar hubeysan",
  "hub", "hubeysan", "hubaysan", "qori", "bastoolad",
  "ak47", "miino", "bam", "bambo",
  "qarax", "qarxay", "qarxis", "is qarxin", "miino qaraxday",
  "tuugo", "tuug", "xatooyo", "xaday", "la xaday",
  "dhac", "boob", "burcad", "burcad badeed",
  "afduub", "afduubay", "la afduubay", "la haysto",
  "kufsi", "kufsaday", "la kufsaday", "faraxumeyn", "xadgudub galmo",
  "dabley", "maleeshiyaad", "koox hubeysan",
  "argagixiso", "argagaxiso", "argagaxisada",
  "alshabaab", "al-shabaab", "isis", "daacish",
  "dambi", "danbi", "fal dambiyeed", "dembiile", "danbiile",
  "hanjabaad", "waan dilayaa", "waan ku dili doonaa",
  "cabsi gelin", "caga jugleyn",
  "rabshad", "qalalaase", "isku dhac", "dagaal", "gacan ka hadal",
  "musuqmaasuq", "laaluush", "lacag dhaqid", "been abuur",
  "daroogo", "maandooriye", "xashiish", "kokain", "heroine",
  "tahriib", "tahriibiye", "jidgooyo", "isbaaro",
  "gubay", "gubid", "dab qabadsiiyay", "burburiyay", "halaag",
];

const fingerprint = (value) =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");

const parseFacebookDate = (value, now = new Date()) => {
  const raw = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s*[·•]\s*(Public|Friends|Shared with.*)$/i, "")
    .trim();
  if (!raw) return null;

  const relative = raw.match(
    /^(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks|daqiiqo|saac|saacadood|maalin|maalmood|todobaad)/i
  );
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2].toLowerCase();
    const milliseconds =
      /^(m|min|mins|minute|minutes|daqiiqo)$/.test(unit)
        ? 60 * 1000
        : /^(h|hr|hrs|hour|hours|saac|saacadood)$/.test(unit)
        ? 60 * 60 * 1000
        : /^(w|week|weeks|todobaad)$/.test(unit)
        ? 7 * 24 * 60 * 60 * 1000
        : 24 * 60 * 60 * 1000;
    return new Date(now.getTime() - amount * milliseconds);
  }

  if (/^(yesterday|shalay)/i.test(raw)) {
    return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  if (/^(today|maanta|just now)/i.test(raw)) return now;

  const normalized = raw.replace(/\bat\b/i, "").replace(/\s*[·•].*$/, "").trim();
  let parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    parsed = new Date(`${normalized} ${now.getFullYear()}`);
  }
  if (Number.isNaN(parsed.getTime())) return null;

  // Facebook omits the year for recent posts. Avoid interpreting a future
  // month/day as belonging to next year.
  if (!/\b\d{4}\b/.test(normalized) && parsed > now) {
    parsed.setFullYear(parsed.getFullYear() - 1);
  }
  return parsed;
};

const checkCrimeText = (text) => {
  const lower = String(text || "").toLowerCase();
  const matched = CRIME_KEYWORDS.find((w) => lower.includes(w));

  return {
    // Used only as emergency fallback when the AI model is unreachable.
    // Keywords alone must not override a live model decision.
    isCrime: Boolean(matched),
    matchedKeyword: matched || null,
    prediction: matched ? "CRIME-RELATED" : "NOT CRIME",
    confidence: matched ? 95 : 50,
  };
};

const escapeRegExp = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const extractAuthorName = (message = "", fallback = "") => {
  const clean = String(message || "").replace(/\s+/g, " ").trim();

  const timeMatch = clean.match(
    /^(.+?)\s+(?:\d+\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)|Yesterday|Today)\b/i
  );

  if (timeMatch?.[1]) return timeMatch[1].trim();

  const parts = clean.split(" ");
  if (parts.length >= 2) return parts.slice(0, 2).join(" ");

  return fallback || "Facebook User";
};

const cleanPostContent = (message = "", authorName = "") => {
  let text = String(message || "").replace(/\s+/g, " ").trim();

  if (authorName) {
    text = text.replace(new RegExp(`^${escapeRegExp(authorName)}\\s*`, "i"), "");
  }

  text = text
    .replace(/all reactions:.*$/i, "")
    .replace(/like comment view more comments.*$/i, "")
    .replace(/view all \d+ replies/gi, "")
    .replace(/\bsee more\b/gi, "")
    .replace(/\b\d+\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/^\d+$/.test(text)) return "";

  return text;
};

const makeStablePostText = (text = "") =>
  String(text)
    .toLowerCase()
    .replace(/all reactions:.*$/i, "")
    .replace(/like comment view more comments.*$/i, "")
    .replace(/view all \d+ replies/gi, "")
    .replace(/\bsee more\b/gi, "")
    .replace(/\b\d+(\.\d+)?k\b/gi, "")
    .replace(/\d+/g, "")
    .replace(/[^\p{L}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

const analyzeFacebookPost = async ({ item, post }) => {
  try {
    const rawMessage = post.message || "";
    if (!rawMessage.trim()) return null;

    const authorName = post.authorName || extractAuthorName(rawMessage, item.name);
    const pageName = item.name;
    const message = cleanPostContent(rawMessage, authorName);

    if (!message.trim()) return null;

    const languageCheck = assertSomaliOnly(message, { allowNumbers: true });
    if (!languageCheck.ok) {
      return {
        history: null,
        alertCreated: false,
        skippedLanguage: true,
        languageReason: languageCheck.reason,
        languageMessage: languageCheck.message,
      };
    }

    const stableText = makeStablePostText(message).slice(0, 250);
    if (!stableText || stableText.length < 20) return null;

    const stableValue = `${item._id}_${stableText}`;
    const postId = `${item._id}_${fingerprint(stableValue)}`;

    let history = await History.findOne({ postId });

    if (history) {
      console.log("DUPLICATE HISTORY BLOCKED:", postId);
      return { history, alertCreated: false };
    }

    let aiResult;
    let usedAiFallback = false;

    try {
      const res = await axios.post(
        AI_MODEL_URL,
        { text: message, allowNumbers: true },
        aiModelRequestConfig({ timeout: 10000 })
      );

      aiResult = res.data;
    } catch (error) {
      console.log("AI model fallback keyword check:", error.message);
      usedAiFallback = true;
      aiResult = checkCrimeText(message);
    }

    const keywordResult = checkCrimeText(message);
    const predictionText = String(aiResult.prediction || "").toUpperCase();

    // Live model decides; keywords only mark evidence. Keyword forces crime only if AI is down.
    const isCrime = usedAiFallback
      ? Boolean(keywordResult.isCrime)
      : aiResult.isCrime === true ||
        aiResult.is_crime === true ||
        predictionText === "CRIME-RELATED" ||
        predictionText === "CRIME RELATED";

    const finalPrediction = isCrime ? "CRIME-RELATED" : "NOT CRIME";

    const finalConfidence =
      aiResult.confidence || (usedAiFallback ? keywordResult.confidence : 50) || 50;

    history = await History.create({
      type: "url",
      sourceType: "facebook",
      content: message,
      url: post.url,
      postId,
      publishedAt: post.publishedAt || null,
      authorName,
      pageName,
      prediction: finalPrediction,
      label:
        aiResult.modelPrediction ||
        aiResult.rawPrediction ||
        aiResult.label ||
        aiResult.prediction ||
        finalPrediction,
      confidence: finalConfidence,
      isCrime,
      matchedKeyword: aiResult.matchedKeyword || aiResult.matched_keyword || keywordResult.matchedKeyword,
      blacklistMatches: [
        {
          item: item._id,
          type: item.type,
          value: item.value,
        },
      ],
    });

    await appendIncomingDataset(history);

    let alertCreated = false;

    if (isCrime) {
      const alertResult = await createDailyBlacklistAlert({
        blacklistItem: item._id,
        history: history._id,
        sourceType: "facebook",
        content: message,
        matchedValue: item.value,
        status: "new",
        postId,
        dedupeContent: stableValue,
      });

      alertCreated = alertResult.created;

      try {
        await dispatchCrimeDetection({ history });
      } catch (error) {
        console.error("FACEBOOK CRIME DISPATCH ERROR:", error.message);
      }
    }

    return { history, alertCreated };
  } catch (error) {
    console.error("Analyze Facebook post error:", error.message);
    return null;
  }
};

const getFacebookPageHandle = (pageUrl = "") => {
  try {
    const parsed = new URL(String(pageUrl).trim());
    const [handle] = parsed.pathname.split("/").filter(Boolean);
    if (!handle || /^(pages|profile\.php|groups|watch)$/i.test(handle)) return null;
    return handle;
  } catch {
    return null;
  }
};

// Prefer Facebook's API when configured. Unlike DOM scraping it supplies a
// canonical created_time, so week/month/year scans can be date-accurate even
// when Facebook hides the public feed behind a login dialog.
const fetchFacebookGraphPosts = async (pageUrl, options = {}) => {
  const accessToken = String(process.env.FACEBOOK_ACCESS_TOKEN || "").trim();
  const handle = getFacebookPageHandle(pageUrl);
  if (!accessToken || !handle) return null;

  try {
    const params = {
      access_token: accessToken,
      fields: "id,message,created_time,permalink_url,from",
      limit: 100,
    };
    if (options.since) {
      params.since = Math.floor(new Date(options.since).getTime() / 1000);
    }
    if (options.until) {
      params.until = Math.floor(new Date(options.until).getTime() / 1000);
    }

    const posts = [];
    let nextUrl = `https://graph.facebook.com/${encodeURIComponent(handle)}/posts`;
    let nextParams = params;
    const maxPages = options.period === "year" ? 20 : 8;

    for (let pageNumber = 0; nextUrl && pageNumber < maxPages; pageNumber += 1) {
      const response = await axios.get(nextUrl, {
        params: nextParams,
        timeout: 20000,
      });
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      rows.forEach((row) => {
        if (!String(row.message || "").trim() || !row.created_time) return;
        posts.push({
          message: row.message,
          authorName: row.from?.name || "",
          url: row.permalink_url || pageUrl,
          publishedAt: row.created_time,
        });
      });
      nextUrl = response.data?.paging?.next || null;
      nextParams = undefined;
    }

    console.log(`Facebook Graph API posts found: ${posts.length}`);
    return posts;
  } catch (error) {
    const graphMessage = error.response?.data?.error?.message || error.message;
    console.warn(`Facebook Graph API unavailable for ${handle}: ${graphMessage}`);
    return null;
  }
};

const scrapeFacebookPosts = async (pageUrl, options = {}) => {
  let browser;

  try {
    const puppeteerArgs = [
      "--disable-dev-shm-usage",
      "--disable-notifications",
      "--disable-blink-features=AutomationControlled",
    ];

    if (process.env.PUPPETEER_NO_SANDBOX === "true") {
      puppeteerArgs.push("--no-sandbox", "--disable-setuid-sandbox");
    }

    browser = await puppeteer.launch({
      headless: true,
      executablePath: CHROME_PATH,
      args: puppeteerArgs,
      defaultViewport: {
        width: 1366,
        height: 768,
      },
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    console.log("Opening Facebook page:", pageUrl);

    // Facebook keeps analytics/chat connections open indefinitely, so
    // `networkidle2` can make an otherwise healthy manual scan look frozen.
    // DOM readiness is enough for the feed; the short settle delay below lets
    // client-rendered articles appear without blocking the API for minutes.
    await page.goto(pageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    console.log("Facebook page loaded");

    await new Promise((resolve) => setTimeout(resolve, 3500));

    // Facebook virtualizes its feed: after scrolling, older articles are often
    // removed from the DOM. Collect every visible batch while scrolling instead
    // of reading the DOM only once at the very end.
    const collectedPosts = new Map();
    const collectVisiblePosts = async () => {
      const visiblePosts = await page.evaluate(() => {
        const results = [];

        document.querySelectorAll("div[role='article']").forEach((article) => {
          const text = article.innerText || "";
          if (text.length < 40) return;

          const link =
            article.querySelector("a[href*='/posts/']") ||
            article.querySelector("a[href*='story_fbid']") ||
            article.querySelector("a[href*='/videos/']") ||
            article.querySelector("a[href*='/reel/']");

          const authorCandidate =
            article.querySelector("h2 strong") ||
            article.querySelector("h3 strong") ||
            article.querySelector("strong span") ||
            article.querySelector("h2 span") ||
            article.querySelector("h3 span");

          const authorName = authorCandidate?.innerText || "";
          const timeElement =
            article.querySelector("time[datetime]") ||
            article.querySelector("abbr[data-utime]") ||
            article.querySelector("[data-utime]");
          const labelledDateElement = Array.from(
            article.querySelectorAll("a[aria-label], a[title], span[aria-label]")
          ).find((element) => {
            const label = `${element.getAttribute("aria-label") || ""} ${
              element.getAttribute("title") || ""
            }`.trim();
            return /(?:\d+\s*(?:m|h|d|w|min|hr|day|week)|yesterday|today|\b20\d{2}\b|january|february|march|april|may|june|july|august|september|october|november|december)/i.test(label);
          });
          const unixTime = timeElement?.getAttribute("data-utime");
          const publishedAt = unixTime
            ? new Date(Number(unixTime) * 1000).toISOString()
            : timeElement?.getAttribute("datetime") || null;
          const dateText =
            timeElement?.getAttribute("aria-label") ||
            timeElement?.getAttribute("title") ||
            labelledDateElement?.getAttribute("aria-label") ||
            labelledDateElement?.getAttribute("title") ||
            labelledDateElement?.textContent ||
            "";

          results.push({
            message: text.replace(/\s+/g, " ").trim(),
            authorName: authorName.replace(/\s+/g, " ").trim(),
            url: link ? link.href : window.location.href,
            publishedAt,
            dateText: dateText.trim(),
          });
        });

        return results;
      });

      visiblePosts.forEach((post) => {
        if (!post.publishedAt && post.dateText) {
          post.publishedAt = parseFacebookDate(post.dateText)?.toISOString() || null;
        }
        const hasPostPermalink =
          /\/(posts|videos|reel)\//i.test(post.url || "") ||
          /[?&]story_fbid=/i.test(post.url || "");
        const key = hasPostPermalink
          ? post.url
          : `${post.authorName}|${post.publishedAt || ""}|${post.message}`;
        if (!collectedPosts.has(key)) collectedPosts.set(key, post);
      });
    };

    await collectVisiblePosts();

    const maxScrolls =
      options.period === "year" ? 60 : options.period === "month" ? 36 : 18;
    // Keep a single-item request within a predictable time even when Facebook
    // continuously extends the page or does not expose usable timestamps.
    const scrollDeadline = Date.now() + 45000;
    const sinceTime = options.since
      ? new Date(options.since).getTime()
      : null;
    let unchangedScrolls = 0;
    let previousHeight = 0;

    for (let i = 0; i < maxScrolls; i += 1) {
      if (Date.now() >= scrollDeadline) break;
      await page.evaluate(() => window.scrollBy(0, 2000));
      await new Promise((resolve) => setTimeout(resolve, 900));
      await collectVisiblePosts();

      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      const knownTimes = Array.from(collectedPosts.values())
        .map((post) => Date.parse(post.publishedAt || ""))
        .filter(Number.isFinite);
      const scrollState = {
        height,
        oldestTime: knownTimes.length ? Math.min(...knownTimes) : null,
      };

      unchangedScrolls =
        scrollState.height === previousHeight ? unchangedScrolls + 1 : 0;
      previousHeight = scrollState.height;

      if (
        (sinceTime && scrollState.oldestTime && scrollState.oldestTime <= sinceTime) ||
        unchangedScrolls >= 3 ||
        (collectedPosts.size === 0 && i >= 4)
      ) {
        break;
      }
    }

    const posts = Array.from(collectedPosts.values());

    if (posts.length === 0) {
      const accessState = await page.evaluate(() => {
        const body = document.body?.innerText || "";
        return {
          loginRequired: /\bLog In\b/i.test(body) && /\bFriends\b/i.test(body),
          unavailable: /content isn't available|page isn't available/i.test(body),
        };
      });
      if (accessState.loginRequired) {
        posts.scrapeWarning =
          "Facebook login is required for this personal/private profile; public posts were not exposed.";
      } else if (accessState.unavailable) {
        posts.scrapeWarning = "Facebook reports that this page is unavailable.";
      }
    }

    console.log("Posts found:", posts.length);
    return posts;
  } catch (error) {
    console.error("Facebook scrape error:", error.message);
    return [];
  } finally {
    if (browser) await browser.close();
  }
};

const scanFacebookItem = async (item, options = {}) => {
  try {
    const graphPosts = await fetchFacebookGraphPosts(item.value, options);
    const posts = graphPosts ?? (await scrapeFacebookPosts(item.value, options));
    const source = graphPosts !== null ? "graph-api" : "browser";
    const since = options.since ? new Date(options.since) : null;
    const until = options.until ? new Date(options.until) : new Date();
    const periodPosts = since
      ? posts.filter((post) => {
          // A period scan must be governed by the post date. Unknown dates are
          // excluded instead of leaking into Last Week/Month/Year results.
          if (!post.publishedAt) return false;
          const publishedAt = new Date(post.publishedAt);
          return (
            !Number.isNaN(publishedAt.getTime()) &&
            publishedAt >= since &&
            publishedAt <= until
          );
        })
      : posts;
    const datedPosts = posts.filter((post) => {
      const time = Date.parse(post.publishedAt || "");
      return Number.isFinite(time);
    }).length;

    let scanned = periodPosts.length;
    let alerts = 0;
    let skippedLanguage = 0;

    for (const post of periodPosts) {
      const result = await analyzeFacebookPost({ item, post });
      if (result?.alertCreated) alerts += 1;
      if (result?.skippedLanguage) skippedLanguage += 1;
    }

    await BlacklistItem.findByIdAndUpdate(item._id, {
      lastScannedAt: new Date(),
      lastScanStatus: `scanned ${scanned} (${options.period || "current"}), language rejected ${skippedLanguage}, alerts ${alerts}`,
    });

    return {
      scanned,
      alerts,
      skippedLanguage,
      skippedOutsidePeriod: posts.length - periodPosts.length,
      period: options.period || null,
      since,
      until,
      source,
      totalFound: posts.length,
      datedPosts,
      undatedPosts: posts.length - datedPosts,
      configurationWarning:
        posts.scrapeWarning || null,
    };
  } catch (error) {
    console.error("Scan Facebook item error:", error.message);

    await BlacklistItem.findByIdAndUpdate(item._id, {
      lastScanStatus: `error: ${error.message}`,
    });

    return { scanned: 0, alerts: 0 };
  }
};

const scanFacebookWatchlist = async (options = {}) => {
  const results = [];
  try {
    const items = await BlacklistItem.find({
      type: "facebook_page",
      active: true,
      monitorEnabled: true,
    });

    console.log("Facebook watchlist items:", items.length);

    for (const item of items) {
      const isAutomaticScan = !options.since;
      const until = options.until ? new Date(options.until) : new Date();
      const defaultSince = new Date(
        until.getTime() - 7 * 24 * 60 * 60 * 1000
      );
      const itemOptions = isAutomaticScan
        ? {
            period: "automatic",
            since: item.lastScannedAt || defaultSince,
            until,
          }
        : options;

      results.push(await scanFacebookItem(item, itemOptions));
    }
  } catch (error) {
    console.error("Facebook watchlist error:", error.message);
  }
  return results;
};

let isScanning = false;

const startFacebookMonitor = () => {
  const intervalMs = Number(process.env.FACEBOOK_MONITOR_INTERVAL_MS || 300000);

  console.log(`Facebook monitor started every ${intervalMs / 1000}s`);

  setTimeout(async () => {
    if (isScanning) return;

    isScanning = true;

    try {
      await scanFacebookWatchlist();
    } finally {
      isScanning = false;
    }
  }, 5000);

  setInterval(async () => {
    if (isScanning) return;

    isScanning = true;

    try {
      await scanFacebookWatchlist();
    } finally {
      isScanning = false;
    }
  }, intervalMs);
};

module.exports = {
  startFacebookMonitor,
  scanFacebookWatchlist,
  scanFacebookItem,
  checkCrimeText,
  parseFacebookDate,
  getFacebookPageHandle,
  fetchFacebookGraphPosts,
  scrapeFacebookPosts,
  analyzeFacebookPost,
};
