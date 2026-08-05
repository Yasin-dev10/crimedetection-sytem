/**
 * Strip residual HTML, tracker URLs, and chrome phrases from Decision display text.
 * Backend already cleans URL extraction; this is a UI safety net for leftover markup.
 */
export function sanitizeDecisionText(value = "") {
  let text = String(value || "");

  text = text
    .replace(/<\/?[a-zA-Z][^>]*>/g, " ")
    .replace(/<\/?[a-zA-Z][^>]*$/g, " ")
    .replace(/<[a-zA-Z]+\s+[^<]*$/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, " ")
    .replace(/&gt;/gi, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/https?:\/\/[^\s<>"']+/gi, " ")
    .replace(/\bwww\.[^\s<>"']+/gi, " ")
    .replace(
      /\b(?:src|href|style|alt|height|width)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
      " "
    )
    .replace(/\b(?:position\s*:\s*absolute|1px)\b/gi, " ")
    .replace(/skip to (main )?content/gi, " ")
    .replace(/u gudub qaybta macluumaadka/gi, " ")
    .replace(/u gudub nuxurka/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}
