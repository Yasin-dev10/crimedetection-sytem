const dns = require("dns");
const net = require("net");
const crypto = require("crypto");
const axios = require("axios");
const cheerio = require("cheerio");

const BlacklistItem = require("../model/BlacklistItem");
const History = require("../model/History");
const { createDailyBlacklistAlert } = require("./blacklistAlertService");
const { dispatchCrimeDetection } = require("./crimeDetectionService");
const { appendIncomingDataset } = require("./datasetStore");
const { checkCrimeText } = require("./facebookMonitor");
const { AI_MODEL_URL, aiModelRequestConfig } = require("../config/aiModel");
const {
  extractCleanPageText,
  cleanSomaliWebsiteText,
} = require("../utils/pageTextCleaner");
const { assertSomaliOnly } = require("../utils/somaliLanguage");

const FETCH_TIMEOUT_MS = 12000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_REDIRECTS = 3;
const MAX_TEXT_LENGTH = 12000;
/** Safety ceiling; by default this covers every article link on normal homepages. */
const MAX_INTERNAL_LINKS = Math.max(
  1,
  Number(process.env.WEBSITE_MAX_INTERNAL_LINKS || 500)
);
const MIN_TEXT_LENGTH = 30;

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

const NON_HTML_EXTENSIONS =
  /\.(jpe?g|png|gif|webp|svg|ico|bmp|tiff?|mp3|mp4|avi|mov|mkv|webm|wav|ogg|pdf|docx?|xlsx?|pptx?|zip|rar|7z|tar|gz|exe|msi|dmg|apk|iso|css|js|mjs|json|xml|rss|woff2?|ttf|eot)$/i;

/* ===========================
   SSRF-SAFE URL VALIDATION
=========================== */

const isBlockedIPv4 = (address) => {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((n) => Number.isNaN(n) || n > 255)) {
    return true;
  }

  const [a, b] = octets;

  if (a === 0) return true; // "this network"
  if (a === 10) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 reserved + 192.0.2.0/24 doc
  if (a === 192 && b === 88) return true; // 6to4 relay
  if (a === 192 && b === 168) return true; // private
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51) return true; // 198.51.100.0/24 doc
  if (a === 203 && b === 0) return true; // 203.0.113.0/24 doc
  if (a >= 224) return true; // multicast, reserved, broadcast

  return false;
};

const isBlockedIPv6 = (address) => {
  let ip = String(address).toLowerCase();

  const zoneIndex = ip.indexOf("%");
  if (zoneIndex !== -1) ip = ip.slice(0, zoneIndex);

  if (ip === "::" || ip === "::1") return true; // unspecified + loopback

  // IPv4-mapped / IPv4-translated addresses: validate the embedded IPv4.
  const mapped = ip.match(/^::(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isBlockedIPv4(mapped[1]);

  const groups = ip.split(":");
  const first = parseInt(groups[0] || "0", 16) || 0;
  const second = parseInt(groups[1] || "0", 16) || 0;

  if (first === 0) return true; // ::/8 reserved
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (first === 0x2001 && second === 0x0db8) return true; // documentation
  if (first === 0x0064 && second === 0xff9b) return true; // NAT64 (may embed private IPv4)

  return false;
};

const isBlockedAddress = (address) => {
  const family = net.isIP(String(address || ""));
  if (family === 4) return isBlockedIPv4(address);
  if (family === 6) return isBlockedIPv6(address);
  return true; // unknown format => block
};

const isBlockedHostname = (hostname = "") => {
  const host = String(hostname).toLowerCase().replace(/^\[|\]$/g, "");
  return (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  );
};

/**
 * Syntactic validation only (no network). Returns { ok, message, url }.
 * Used both by the scanner and by blacklist create/update validation.
 */
const validateWebsiteUrlValue = (value) => {
  const raw = String(value || "").trim();

  if (!raw) {
    return { ok: false, message: "Website URL is required" };
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return {
      ok: false,
      message: "Website value must be a valid absolute URL (e.g. https://example.com)",
    };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return {
      ok: false,
      message: "Only http:// and https:// website URLs are allowed",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      ok: false,
      message: "Website URL must not contain a username or password",
    };
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, "");

  if (isBlockedHostname(host)) {
    return { ok: false, message: "This hostname is not allowed" };
  }

  if (net.isIP(host) && isBlockedAddress(host)) {
    return {
      ok: false,
      message: "Private, loopback and reserved IP addresses are not allowed",
    };
  }

  return { ok: true, message: null, url: parsed };
};

/**
 * Full safety check for a fetch target: syntax + DNS resolution of every
 * address the hostname resolves to. Throws on unsafe targets.
 */
const assertSafeUrl = async (targetUrl) => {
  const check = validateWebsiteUrlValue(targetUrl);
  if (!check.ok) throw new Error(check.message);

  const parsed = check.url;
  const host = parsed.hostname.replace(/^\[|\]$/g, "");

  if (net.isIP(host)) return parsed; // already validated above

  let addresses;
  try {
    addresses = await dns.promises.lookup(host, { all: true, verbatim: true });
  } catch (error) {
    throw new Error(`DNS lookup failed for ${host}: ${error.message}`);
  }

  if (!addresses.length) {
    throw new Error(`DNS lookup returned no addresses for ${host}`);
  }

  const blocked = addresses.find((entry) => isBlockedAddress(entry.address));
  if (blocked) {
    throw new Error(
      `Host ${host} resolves to a blocked address (${blocked.address})`
    );
  }

  return parsed;
};

// Guarded DNS lookup handed to axios so the actual connection also refuses
// private addresses (protects against DNS rebinding between check and fetch).
const guardedLookup = (hostname, options, callback) => {
  const opts = typeof options === "function" ? {} : options || {};
  const cb = typeof options === "function" ? options : callback;

  dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
    if (err) return cb(err);

    const list = Array.isArray(addresses)
      ? addresses
      : [{ address: addresses, family: 4 }];

    const blocked = list.find((entry) => isBlockedAddress(entry.address));
    if (blocked) {
      return cb(
        new Error(`Blocked address ${blocked.address} for host ${hostname}`)
      );
    }

    if (opts.all) return cb(null, list);
    return cb(null, list[0].address, list[0].family);
  });
};

/* ===========================
   SAFE PAGE FETCHING
=========================== */

const isHtmlLikeContentType = (contentType = "") => {
  const type = String(contentType).toLowerCase().split(";")[0].trim();
  return (
    type === "text/html" ||
    type === "application/xhtml+xml" ||
    type === "text/plain" ||
    type === ""
  );
};

/**
 * Fetches a page with manual redirect handling. Every redirect target is
 * re-validated (scheme, credentials, DNS) before being followed.
 */
const fetchPageSafely = async (targetUrl) => {
  let currentUrl = String(targetUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const parsed = await assertSafeUrl(currentUrl);

    const response = await axios.get(parsed.toString(), {
      timeout: FETCH_TIMEOUT_MS,
      // Do not inherit a broken HTTP_PROXY/HTTPS_PROXY value from the host.
      // DNS and redirect SSRF protections below still validate every target.
      proxy: false,
      maxRedirects: 0,
      responseType: "text",
      maxContentLength: MAX_RESPONSE_BYTES,
      maxBodyLength: MAX_RESPONSE_BYTES,
      lookup: guardedLookup,
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (response.status >= 300) {
      const location = response.headers?.location;

      if (!location) {
        throw new Error(`Redirect (${response.status}) without Location header`);
      }

      if (hop === MAX_REDIRECTS) {
        throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`);
      }

      currentUrl = new URL(location, parsed).toString();
      continue;
    }

    const contentType = response.headers?.["content-type"] || "";

    if (!isHtmlLikeContentType(contentType)) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    return {
      finalUrl: parsed.toString(),
      html: String(response.data || ""),
    };
  }

  throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`);
};

/* ===========================
   CONTENT EXTRACTION
=========================== */

const normalizeWhitespace = (value = "") =>
  String(value).replace(/\s+/g, " ").trim();

const extractPageContent = (html = "") => {
  const $ = cheerio.load(String(html || ""));
  const publishedValue =
    $("meta[property='article:published_time']").attr("content") ||
    $("meta[name='date']").attr("content") ||
    $("meta[name='pubdate']").attr("content") ||
    $("time[datetime]").first().attr("datetime") ||
    null;
  const parsedPublishedAt = publishedValue ? new Date(publishedValue) : null;
  const publishedAt =
    parsedPublishedAt && !Number.isNaN(parsedPublishedAt.getTime())
      ? parsedPublishedAt
      : null;
  $("script, style, noscript, nav, footer, svg, iframe, img").remove();
  const title = normalizeWhitespace($("title").first().text());
  const text = cleanSomaliWebsiteText(
    extractCleanPageText(html, MAX_TEXT_LENGTH),
    MAX_TEXT_LENGTH
  );
  return { $, title, text, publishedAt };
};

const normalizePageUrl = (value = "") => {
  try {
    const parsed = new URL(String(value));
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();

    if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }

    return parsed.toString();
  } catch {
    return String(value).trim();
  }
};

const discoverInternalLinks = ($, baseUrl, limit = MAX_INTERNAL_LINKS) => {
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }

  const baseNormalized = normalizePageUrl(baseUrl);
  const basePathParts = base.pathname.split("/").filter(Boolean);
  const languageSection =
    basePathParts.length === 1 &&
    /^(somali|so|soomaali)$/i.test(basePathParts[0])
      ? basePathParts[0].toLowerCase()
      : null;
  const seen = new Set();
  const links = [];

  $("a[href]").each((_, element) => {
    const href = String($(element).attr("href") || "").trim();

    if (!href || href.startsWith("#")) return;
    if (/^(javascript|mailto|tel|data|file|ftp|blob|about):/i.test(href)) return;

    let resolved;
    try {
      resolved = new URL(href, base);
    } catch {
      return;
    }

    if (!["http:", "https:"].includes(resolved.protocol)) return;
    if (resolved.username || resolved.password) return;
    if (resolved.origin !== base.origin) return; // never leave origin
    if (NON_HTML_EXTENSIONS.test(resolved.pathname)) return;
    if (
      languageSection &&
      !resolved.pathname.toLowerCase().startsWith(`/${languageSection}/`)
    ) {
      return;
    }

    resolved.hash = "";
    const normalized = normalizePageUrl(resolved.toString());

    if (normalized === baseNormalized) return;
    if (seen.has(normalized)) return;

    seen.add(normalized);
    const label = normalizeWhitespace($(element).text());
    const pathParts = resolved.pathname.split("/").filter(Boolean);
    const score =
      Math.min(label.length, 120) +
      pathParts.length * 15 +
      (/\b(news|article|story|war|warar|somali)\b/i.test(resolved.pathname)
        ? 40
        : 0) +
      (/\/20\d{2}\//.test(resolved.pathname) ? 30 : 0);

    links.push({ url: resolved.toString(), score });
  });

  return links
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.url);
};

/* ===========================
   ANALYSIS + PERSISTENCE
=========================== */

const fingerprint = (value) =>
  crypto.createHash("sha256").update(String(value || "")).digest("hex");

const makeStablePageText = (text = "") =>
  String(text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const runCrimePrediction = async (text) => {
  let aiResult;
  let usedAiFallback = false;

  try {
    const res = await axios.post(
      AI_MODEL_URL,
      { text },
      aiModelRequestConfig({ timeout: 10000 })
    );
    aiResult = res.data || {};
  } catch (error) {
    console.log("AI model fallback keyword check (website):", error.message);
    usedAiFallback = true;
    aiResult = checkCrimeText(text);
  }

  const keywordResult = checkCrimeText(text);
  const predictionText = String(aiResult.prediction || "").toUpperCase();

  // Live model decides; keywords only mark evidence. Keyword forces crime only if AI is down.
  const isCrime = usedAiFallback
    ? Boolean(keywordResult.isCrime)
    : aiResult.isCrime === true ||
      aiResult.is_crime === true ||
      predictionText === "CRIME-RELATED" ||
      predictionText === "CRIME RELATED";

  return {
    isCrime,
    prediction: isCrime ? "CRIME-RELATED" : "NOT CRIME",
    confidence:
      aiResult.confidence || (usedAiFallback ? keywordResult.confidence : 50) || 50,
    matchedKeyword:
      aiResult.matchedKeyword ||
      aiResult.matched_keyword ||
      keywordResult.matchedKeyword,
  };
};

/**
 * Analyzes one scraped page snapshot. Returns
 * { history, created, alertCreated } or null when the page has no usable text.
 */
const analyzeWebsitePage = async ({
  item,
  pageUrl,
  text,
  publishedAt,
  since,
  until,
}) => {
  const cleanText = normalizeWhitespace(text).slice(0, MAX_TEXT_LENGTH);

  if (!cleanText || cleanText.length < MIN_TEXT_LENGTH) return null;

  if (since) {
    const publishedTime = publishedAt ? new Date(publishedAt).getTime() : NaN;
    const sinceTime = new Date(since).getTime();
    const untilTime = until ? new Date(until).getTime() : Date.now();

    if (
      !Number.isFinite(publishedTime) ||
      publishedTime < sinceTime ||
      publishedTime > untilTime
    ) {
      return {
        history: null,
        created: false,
        alertCreated: false,
        skippedPeriod: true,
      };
    }
  }

  // Website monitoring must enforce the same language boundary as interactive
  // text, URL, and file analysis. Do this before both the AI request and the
  // keyword fallback so rejected pages can never become keyword crime alerts.
  // News articles legitimately contain dates, casualty counts, and other
  // numbers. They must not be rejected merely for containing digits.
  const languageCheck = assertSomaliOnly(cleanText, { allowNumbers: true });
  if (!languageCheck.ok) {
    return {
      history: null,
      created: false,
      alertCreated: false,
      skippedLanguage: true,
      languageReason: languageCheck.reason,
      languageMessage: languageCheck.message,
    };
  }

  const normalizedUrl = normalizePageUrl(pageUrl);
  const textHash = fingerprint(makeStablePageText(cleanText));
  const postId = `web_${item._id}_${fingerprint(`${normalizedUrl}|${textHash}`)}`;

  const existing = await History.findOne({ postId });

  if (existing) {
    return { history: existing, created: false, alertCreated: false };
  }

  const verdict = await runCrimePrediction(cleanText);

  let history;

  try {
    history = await History.create({
      type: "url",
      sourceType: "website",
      content: cleanText,
      extractedText: cleanText,
      url: pageUrl,
      postId,
      publishedAt: publishedAt || null,
      pageName: item.name,
      prediction: verdict.prediction,
      confidence: verdict.confidence,
      isCrime: verdict.isCrime,
      matchedKeyword: verdict.matchedKeyword,
      blacklistMatches: [
        {
          item: item._id,
          type: item.type,
          value: item.value,
        },
      ],
    });

    await appendIncomingDataset(history);
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = await History.findOne({ postId });
      return { history: duplicate, created: false, alertCreated: false };
    }
    throw error;
  }

  let alertCreated = false;

  if (verdict.isCrime) {
    const alertResult = await createDailyBlacklistAlert({
      blacklistItem: item._id,
      history: history._id,
      sourceType: "website",
      content: cleanText.slice(0, 1000),
      matchedValue: item.value,
      status: "new",
      postId,
      dedupeContent: `${item._id}_${normalizedUrl}_${textHash}`,
    });

    alertCreated = alertResult.created;

    try {
      await dispatchCrimeDetection({ history });
    } catch (error) {
      console.error("WEBSITE CRIME DISPATCH ERROR:", error.message);
    }
  }

  return { history, created: true, alertCreated };
};

/* ===========================
   SCANNING
=========================== */

/**
 * True when this URL was already stored for the website blacklist item.
 */
const hasScrapedWebsiteUrl = async (itemId, pageUrl) => {
  const normalizedUrl = normalizePageUrl(pageUrl);
  const existing = await History.findOne({
    sourceType: "website",
    "blacklistMatches.item": itemId,
    $or: [{ url: pageUrl }, { url: normalizedUrl }],
  })
    .select("_id")
    .lean();

  return Boolean(existing);
};

/**
 * Scans one website blacklist item by id: opens the homepage, ranks likely
 * article links, then analyzes several new Somali pages.
 */
const scanWebsiteItem = async (item, options = {}) => {
  const result = {
    itemId: item?._id || null,
    name: item?.name || null,
    scanned: 0,
    newRecords: 0,
    alerts: 0,
    skippedLanguage: false,
    languageReason: null,
    newsUrl: null,
    errors: [],
    period: options.period || null,
    since: options.since || null,
    until: options.until || null,
    skippedOutsidePeriod: 0,
  };

  if (!item || item.type !== "website") {
    result.errors.push("Blacklist item is not of type website");
    return result;
  }

  if (item.active === false) {
    result.errors.push("Blacklist item is inactive");
    return result;
  }

  const rootCheck = validateWebsiteUrlValue(item.value);

  if (!rootCheck.ok) {
    result.errors.push(`Invalid website URL: ${rootCheck.message}`);

    await BlacklistItem.findByIdAndUpdate(item._id, {
      lastScannedAt: new Date(),
      lastScanStatus: `error: ${rootCheck.message}`,
    }).catch(() => {});

    return result;
  }

  try {
    const rootUrl = rootCheck.url.toString();
    let articleCandidates = [];

    // 1) Fetch homepage only to discover news links
    try {
      const { finalUrl, html } = await fetchPageSafely(rootUrl);
      const { $ } = extractPageContent(html);
      articleCandidates = discoverInternalLinks($, finalUrl, MAX_INTERNAL_LINKS);
    } catch (error) {
      result.errors.push(`Homepage: ${error.message}`);
      await BlacklistItem.findByIdAndUpdate(item._id, {
        lastScannedAt: new Date(),
        lastScanStatus: `error: ${String(error.message).slice(0, 180)}`,
      }).catch(() => {});
      return result;
    }

    if (!articleCandidates.length) {
      // No article links — fall back to analyzing the homepage once if never saved
      const alreadyRoot = await hasScrapedWebsiteUrl(item._id, rootUrl);
      if (!alreadyRoot) {
        articleCandidates = [rootUrl];
      } else {
        const statusText = "no new news links found";
        await BlacklistItem.findByIdAndUpdate(item._id, {
          lastScannedAt: new Date(),
          lastScanStatus: statusText,
        });
        return result;
      }
    }

    // Inspect every article candidate discovered on the page. The publication
    // date check below decides whether it belongs to the requested period.
    const maxAttempts = MAX_INTERNAL_LINKS;
    let attempts = 0;

    for (const candidateUrl of articleCandidates) {
      if (attempts >= maxAttempts) break;

      const already = await hasScrapedWebsiteUrl(item._id, candidateUrl);
      if (already) continue;
      attempts += 1;

      try {
        const { finalUrl, html } = await fetchPageSafely(candidateUrl);
        const { text, publishedAt } = extractPageContent(html);
        result.scanned += 1;
        result.newsUrl = finalUrl;

        const analysis = await analyzeWebsitePage({
          item,
          pageUrl: finalUrl,
          text,
          publishedAt,
          since: options.since,
          until: options.until,
        });

        if (analysis?.created) result.newRecords += 1;
        if (analysis?.alertCreated) result.alerts += 1;
        if (analysis?.skippedPeriod) result.skippedOutsidePeriod += 1;
        if (analysis?.skippedLanguage) {
          result.skippedLanguage = true;
          result.languageReason = analysis.languageReason || "not_somali";
        }
      } catch (candidateError) {
        result.errors.push(`${candidateUrl}: ${candidateError.message}`);
      }
    }

    const statusText =
      result.newRecords > 0
        ? `scraped ${result.newRecords} news, alerts ${result.alerts}`
        : result.skippedLanguage
        ? `skipped-language: ${result.languageReason}`
        : result.errors.length
        ? `error: ${result.errors[0].slice(0, 180)}`
        : "no new news scraped";

    await BlacklistItem.findByIdAndUpdate(item._id, {
      lastScannedAt: new Date(),
      lastScanStatus: statusText,
    });
  } catch (error) {
    console.error("Scan website item error:", error.message);
    result.errors.push(error.message);

    await BlacklistItem.findByIdAndUpdate(item._id, {
      lastScannedAt: new Date(),
      lastScanStatus: `error: ${String(error.message).slice(0, 180)}`,
    }).catch(() => {});
  }

  return result;
};

/**
 * Scans every active, monitor-enabled website blacklist item.
 * Manual trigger only — no background timer is started for websites.
 */
const scanWebsiteWatchlist = async (options = {}) => {
  const results = [];

  try {
    const items = await BlacklistItem.find({
      type: "website",
      active: true,
      monitorEnabled: true,
    });

    console.log("Website watchlist items:", items.length);

    for (const item of items) {
      const result = await scanWebsiteItem(item, options);
      results.push(result);
    }
  } catch (error) {
    console.error("Website watchlist error:", error.message);
  }

  return results;
};

module.exports = {
  scanWebsiteItem,
  scanWebsiteWatchlist,
  // exported for validation reuse and tests
  validateWebsiteUrlValue,
  assertSafeUrl,
  fetchPageSafely,
  isBlockedAddress,
  normalizePageUrl,
  extractPageContent,
  analyzeWebsitePage,
  runCrimePrediction,
};
