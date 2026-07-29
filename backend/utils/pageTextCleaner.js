const cheerio = require("cheerio");

const NON_CONTENT_SELECTORS = [
  "script",
  "style",
  "noscript",
  "template",
  "svg",
  "iframe",
  "object",
  "embed",
  "canvas",
  "link",
  "meta",
  "img",
  "picture",
  "source",
  "video",
  "audio",
  "header",
  "footer",
  "nav",
  "aside",
  "form",
  "button",
  "[hidden]",
  "[aria-hidden='true']",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  "[role='complementary']",
  "[class*='cookie' i]",
  "[id*='cookie' i]",
  "[class*='newsletter' i]",
  "[class*='advert' i]",
  "[class*='ads' i]",
  "[data-testid*='navigation' i]",
].join(", ");

const CHROME_PHRASES = [
  /skip to content/gi,
  /skip to main content/gi,
  /u gudub qaybta macluumaadka/gi,
  /u gudub nuxurka/gi,
  /accept (all )?cookies?/gi,
  /cookie settings?/gi,
  /sign in/gi,
  /log in/gi,
  /subscribe/gi,
  /share this/gi,
  /related stories/gi,
];

const normalizeWhitespace = (value = "") =>
  String(value).replace(/\s+/g, " ").trim();

const stripResidualMarkup = (value = "") =>
  String(value)
    // Closed HTML tags
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
    // Truncated / unclosed tags (common when text is sliced mid-attribute)
    .replace(/<\/?[a-zA-Z][^>]*$/g, " ")
    .replace(/<[a-zA-Z]+\s+[^<]*$/g, " ")
    // HTML entity noise
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, " ")
    .replace(/&gt;/gi, " ")
    .replace(/&#\d+;/g, " ")
    // Tracking / absolute URLs (including truncated ones)
    .replace(/https?:\/\/[^\s<>"']+/gi, " ")
    .replace(/\bwww\.[^\s<>"']+/gi, " ")
    // Attribute debris from broken <img> trackers
    .replace(/\b(?:src|href|style|alt|height|width)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, " ")
    .replace(/\b(?:position\s*:\s*absolute|1px)\b/gi, " ")
    // Common tracker query leftovers
    .replace(/\b[sx]\d+=\[[^\]]*\]/gi, " ")
    .replace(/\burn%3a[^\s]+/gi, " ");

const stripChromePhrases = (value = "") => {
  let text = String(value);
  for (const pattern of CHROME_PHRASES) {
    text = text.replace(pattern, " ");
  }
  return text;
};

/**
 * Extract human-readable article text from HTML for analysis + Decision UI.
 * Removes scripts, nav chrome, images/trackers, residual tags, and URLs.
 */
const extractCleanPageText = (html = "", maxLength = 8000) => {
  const $ = cheerio.load(String(html || ""), {
    xml: false,
  });

  $(NON_CONTENT_SELECTORS).remove();

  // Drop empty or tracking-only anchors leftover
  $("a").each((_, el) => {
    const href = String($(el).attr("href") || "");
    const label = normalizeWhitespace($(el).text());
    if (!label || /^https?:\/\//i.test(label) || href.startsWith("javascript:")) {
      $(el).remove();
    }
  });

  const title = normalizeWhitespace($("title").first().text());
  const headline = normalizeWhitespace(
    $("h1").first().text() || $('meta[property="og:title"]').attr("content") || ""
  );

  const articleRoot = (() => {
    if ($("article").first().length) return $("article").first();
    if ($("main").first().length) return $("main").first();
    if ($('[role="main"]').first().length) return $('[role="main"]').first();
    if ($(".story-body, .article-body").first().length) {
      return $(".story-body, .article-body").first();
    }
    return $("body");
  })();

  // Prefer actual prose blocks. A broad <main> often contains navigation,
  // cards, recommendations, and multilingual labels that are not part of the
  // article itself.
  const proseParts = [];
  articleRoot
    .find(
      "h1, [data-component='headline-block'] h1, [data-component='text-block'] p, .story-body p, .article-body p, p"
    )
    .each((_, element) => {
      const part = normalizeWhitespace($(element).text());
      if (part.length >= 20 && !proseParts.includes(part)) {
        proseParts.push(part);
      }
    });

  let bodyText = normalizeWhitespace(
    proseParts.join(" ") || articleRoot.text()
  );
  bodyText = stripResidualMarkup(bodyText);
  bodyText = stripChromePhrases(bodyText);
  bodyText = normalizeWhitespace(bodyText);

  const parts = [];
  if (headline && !bodyText.toLowerCase().includes(headline.toLowerCase().slice(0, 40))) {
    parts.push(headline);
  } else if (
    title &&
    !bodyText.toLowerCase().includes(title.toLowerCase().slice(0, 40))
  ) {
    parts.push(title);
  }
  if (bodyText) parts.push(bodyText);

  return normalizeWhitespace(parts.join(". ")).slice(0, maxLength);
};

/**
 * Clean already-extracted text before showing in Decision / sending to model.
 */
const cleanExtractedText = (value = "", maxLength = 8000) => {
  let text = stripResidualMarkup(value);
  text = stripChromePhrases(text);
  text = normalizeWhitespace(text);
  return text.slice(0, maxLength);
};

/**
 * Website-monitoring cleanup: retain Latin-script Somali text while removing
 * Arabic and other scripts that can leak in from widgets, related stories,
 * advertisements, or multilingual navigation.
 */
const cleanSomaliWebsiteText = (value = "", maxLength = 8000) => {
  const withoutOtherScripts = Array.from(String(value || ""))
    .map((character) => {
      if (!/\p{L}/u.test(character)) return character;
      return /\p{Script=Latin}/u.test(character) ? character : " ";
    })
    .join("");

  return cleanExtractedText(withoutOtherScripts, maxLength);
};

module.exports = {
  extractCleanPageText,
  cleanExtractedText,
  cleanSomaliWebsiteText,
  stripResidualMarkup,
};
