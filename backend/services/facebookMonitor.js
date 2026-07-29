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
        { text: message },
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
      confidence: finalConfidence,
      isCrime,
      matchedKeyword: aiResult.matchedKeyword || aiResult.matched_keyword || keywordResult.matchedKeyword,
      blacklistMatches: [
        {
          item: item._id,
          type: item.type,
          value: item.value,
          priority: item.priority,
        },
      ],
      priority: item.priority || "high",
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
        priority: item.priority || "high",
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

    console.log("Opening Facebook page:", pageUrl);

    await page.goto(pageUrl, {
      waitUntil: "networkidle2",
      timeout: 120000,
    });

    console.log("Facebook page loaded");

    await new Promise((resolve) => setTimeout(resolve, 8000));

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
          const unixTime = timeElement?.getAttribute("data-utime");
          const publishedAt = unixTime
            ? new Date(Number(unixTime) * 1000).toISOString()
            : timeElement?.getAttribute("datetime") || null;

          results.push({
            message: text.replace(/\s+/g, " ").trim(),
            authorName: authorName.replace(/\s+/g, " ").trim(),
            url: link ? link.href : window.location.href,
            publishedAt,
          });
        });

        return results;
      });

      visiblePosts.forEach((post) => {
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
      options.period === "year" ? 120 : options.period === "month" ? 45 : 18;
    const sinceTime = options.since
      ? new Date(options.since).getTime()
      : null;
    let unchangedScrolls = 0;
    let previousHeight = 0;

    for (let i = 0; i < maxScrolls; i += 1) {
      await page.evaluate(() => window.scrollBy(0, 2000));
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await collectVisiblePosts();

      const scrollState = await page.evaluate(() => {
        const times = Array.from(
          document.querySelectorAll(
            "div[role='article'] time[datetime], div[role='article'] [data-utime]"
          )
        )
          .map((element) => {
            const unixTime = element.getAttribute("data-utime");
            const value = unixTime
              ? Number(unixTime) * 1000
              : Date.parse(element.getAttribute("datetime") || "");
            return Number.isFinite(value) ? value : null;
          })
          .filter((value) => value !== null);

        return {
          height: document.documentElement.scrollHeight,
          oldestTime: times.length ? Math.min(...times) : null,
        };
      });

      unchangedScrolls =
        scrollState.height === previousHeight ? unchangedScrolls + 1 : 0;
      previousHeight = scrollState.height;

      if (
        (sinceTime && scrollState.oldestTime && scrollState.oldestTime <= sinceTime) ||
        unchangedScrolls >= 3
      ) {
        break;
      }
    }

    const posts = Array.from(collectedPosts.values());

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
    const posts = await scrapeFacebookPosts(item.value, options);
    const since = options.since ? new Date(options.since) : null;
    const until = options.until ? new Date(options.until) : new Date();
    const periodPosts = since
      ? posts.filter((post) => {
          // Facebook frequently hides the machine-readable timestamp. Keep
          // those posts so they are not silently lost; postId deduplication
          // prevents them from being stored again on later scans.
          if (!post.publishedAt) return true;
          const publishedAt = new Date(post.publishedAt);
          return (
            !Number.isNaN(publishedAt.getTime()) &&
            publishedAt >= since &&
            publishedAt <= until
          );
        })
      : posts;

    let scanned = periodPosts.length;
    let alerts = 0;

    for (const post of periodPosts) {
      const result = await analyzeFacebookPost({ item, post });
      if (result?.alertCreated) alerts += 1;
    }

    await BlacklistItem.findByIdAndUpdate(item._id, {
      lastScannedAt: new Date(),
      lastScanStatus: `scanned ${scanned} (${options.period || "current"}), alerts ${alerts}`,
    });

    return {
      scanned,
      alerts,
      skippedOutsidePeriod: posts.length - periodPosts.length,
      period: options.period || null,
      since,
      until,
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
};
