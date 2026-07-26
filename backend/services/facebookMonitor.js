const puppeteer = require("puppeteer");
const axios = require("axios");
const crypto = require("crypto");

const BlacklistAlert = require("../model/BlacklistAlert");
const BlacklistItem = require("../model/BlacklistItem");
const History = require("../model/History");
const { createDailyBlacklistAlert } = require("./blacklistAlertService");
const { dispatchCrimeDetection } = require("./crimeDetectionService");
const { appendIncomingDataset } = require("./datasetStore");
const { AI_MODEL_URL } = require("../config/aiModel");

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

    try {
      const res = await axios.post(
        AI_MODEL_URL,
        { text: message },
        { timeout: 10000 }
      );

      aiResult = res.data;
    } catch (error) {
      console.log("AI model fallback keyword check:", error.message);
      aiResult = checkCrimeText(message);
    }

    const keywordResult = checkCrimeText(message);
    const predictionText = String(aiResult.prediction || "").toUpperCase();

    const isCrime =
      aiResult.isCrime === true ||
      aiResult.is_crime === true ||
      predictionText === "CRIME-RELATED" ||
      predictionText === "CRIME RELATED" ||
      keywordResult.isCrime;

    const finalPrediction = isCrime ? "CRIME-RELATED" : "NOT CRIME";

    const finalConfidence = isCrime
      ? Math.max(aiResult.confidence || 0, keywordResult.confidence || 95)
      : aiResult.confidence || keywordResult.confidence || 50;

    history = await History.create({
      type: "url",
      sourceType: "facebook",
      content: message,
      url: post.url,
      postId,
      authorName,
      pageName,
      prediction: finalPrediction,
      confidence: finalConfidence,
      isCrime,
      matchedKeyword: aiResult.matchedKeyword || keywordResult.matchedKeyword,
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

const scrapeFacebookPosts = async (pageUrl) => {
  let browser;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: CHROME_PATH,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-notifications",
        "--disable-blink-features=AutomationControlled",
      ],
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

    for (let i = 0; i < 4; i += 1) {
      await page.evaluate(() => window.scrollBy(0, 2000));
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    const posts = await page.evaluate(() => {
      const results = [];

      document.querySelectorAll("div[role='article']").forEach((article) => {
        const text = article.innerText || "";
        if (text.length < 40) return;

        const link =
          article.querySelector("a[href*='/posts/']") ||
          article.querySelector("a[href*='story_fbid']") ||
          article.querySelector("a[href*='/videos/']");

        const authorCandidate =
          article.querySelector("h2 strong") ||
          article.querySelector("h3 strong") ||
          article.querySelector("strong span") ||
          article.querySelector("h2 span") ||
          article.querySelector("h3 span");

        const authorName = authorCandidate?.innerText || "";

        results.push({
          message: text.replace(/\s+/g, " ").trim(),
          authorName: authorName.replace(/\s+/g, " ").trim(),
          url: link ? link.href : window.location.href,
        });
      });

      return results.slice(0, 5);
    });

    console.log("Posts found:", posts.length);
    return posts;
  } catch (error) {
    console.error("Facebook scrape error:", error.message);
    return [];
  } finally {
    if (browser) await browser.close();
  }
};

const scanFacebookItem = async (item) => {
  try {
    const posts = await scrapeFacebookPosts(item.value);

    let scanned = posts.length;
    let alerts = 0;

    for (const post of posts) {
      const result = await analyzeFacebookPost({ item, post });
      if (result?.alertCreated) alerts += 1;
    }

    await BlacklistItem.findByIdAndUpdate(item._id, {
      lastScannedAt: new Date(),
      lastScanStatus: `scanned ${scanned}, alerts ${alerts}`,
    });

    return { scanned, alerts };
  } catch (error) {
    console.error("Scan Facebook item error:", error.message);

    await BlacklistItem.findByIdAndUpdate(item._id, {
      lastScannedAt: new Date(),
      lastScanStatus: `error: ${error.message}`,
    });

    return { scanned: 0, alerts: 0 };
  }
};

const scanFacebookWatchlist = async () => {
  try {
    const items = await BlacklistItem.find({
      type: "facebook_page",
      active: true,
      monitorEnabled: true,
    });

    console.log("Facebook watchlist items:", items.length);

    for (const item of items) {
      await scanFacebookItem(item);
    }
  } catch (error) {
    console.error("Facebook watchlist error:", error.message);
  }
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
