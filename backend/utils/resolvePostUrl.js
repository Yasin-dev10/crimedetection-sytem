/**
 * Resolve the best available post/source link from a History (or history-like) record.
 * Many older facebook rows only have a page homepage URL, or store the link in content.
 */

const URL_IN_TEXT_RE = /https?:\/\/[^\s"'<>)\]}]+/gi;

const cleanUrl = (value) => {
  if (!value) return null;
  let url = String(value).trim();
  if (!url) return null;
  // strip common trailing punctuation
  url = url.replace(/[),.;]+$/g, "");
  if (!/^https?:\/\//i.test(url)) return null;
  return url;
};

const extractUrlFromText = (text) => {
  if (!text) return null;
  const matches = String(text).match(URL_IN_TEXT_RE);
  if (!matches?.length) return null;
  return cleanUrl(matches[0]);
};

const isFacebookPageHome = (url) => {
  if (!url || !/facebook\.com/i.test(url)) return false;
  // homepage like facebook.com/PageName — not a post permalink
  return !/\/(posts|permalink|story\.php|photo|video|watch|reel|share)\b/i.test(url);
};

const blacklistValueAsUrl = (history) => {
  const matches = history?.blacklistMatches || [];
  for (const match of matches) {
    const item = match?.item;
    const value = cleanUrl(item?.value || match?.value);
    if (value) return value;
    // facebook_page values may be stored without protocol
    const raw = String(item?.value || match?.value || "").trim();
    if (!raw) continue;
    if (/facebook\.com/i.test(raw)) {
      return cleanUrl(raw.startsWith("http") ? raw : `https://${raw.replace(/^\/\//, "")}`);
    }
    if (item?.type === "website" || match?.type === "website") {
      return cleanUrl(raw.startsWith("http") ? raw : `https://${raw}`);
    }
    if (item?.type === "facebook_page" || match?.type === "facebook_page") {
      if (/^https?:\/\//i.test(raw)) return cleanUrl(raw);
      // slug or numeric page id
      return `https://www.facebook.com/${raw.replace(/^@/, "")}`;
    }
  }
  return null;
};

/**
 * @param {object|null} history History lean doc
 * @returns {string|null}
 */
const resolveHistoryPostUrl = (history) => {
  if (!history || typeof history !== "object") return null;

  const direct = cleanUrl(history.url);
  const fromContent = extractUrlFromText(history.content);
  const fromExtracted = extractUrlFromText(history.extractedText);
  const fromBlacklist = blacklistValueAsUrl(history);

  // Prefer a concrete post permalink over a bare page homepage when possible
  const candidates = [direct, fromContent, fromExtracted, fromBlacklist].filter(Boolean);

  const postLike = candidates.find((u) => !isFacebookPageHome(u));
  if (postLike) return postLike;

  if (direct) return direct;
  if (fromContent) return fromContent;
  if (fromExtracted) return fromExtracted;
  if (fromBlacklist) return fromBlacklist;

  // Last resort: build facebook page URL from pageName if it looks like a handle
  const pageName = String(history.pageName || "").trim();
  if (pageName && history.sourceType === "facebook") {
    if (/^https?:\/\//i.test(pageName)) return cleanUrl(pageName);
    if (/^[A-Za-z0-9._-]+$/.test(pageName)) {
      return `https://www.facebook.com/${pageName}`;
    }
  }

  return null;
};

module.exports = {
  resolveHistoryPostUrl,
  extractUrlFromText,
  cleanUrl,
};
