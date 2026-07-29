import React from "react";

/** Somali / crime terms used to highlight why content was flagged as crime */
const CRIME_TERMS = [
  "fal dambiyeed",
  "fal danbiyeed",
  "gacan ku dhiigle",
  "waan ku dili doonaa",
  "waan dilayaa",
  "weerar hubeysan",
  "miino qaraxday",
  "xadgudub galmo",
  "caga jugleyn",
  "gacan ka hadal",
  "cabsi gelin",
  "la kufsaday",
  "la weeraray",
  "la afduubay",
  "la xaday",
  "la dilay",
  "la toogtay",
  "la dhaawacay",
  "la haysto",
  "furay rasaas",
  "dhaawac culus",
  "koox hubeysan",
  "lacag dhaqid",
  "been abuur",
  "dab qabadsiiyay",
  "al-shabaab",
  "alshabaab",
  "argagaxisada",
  "argagaxiso",
  "argagixiso",
  "maleeshiyaad",
  "musuqmaasuq",
  "maandooriye",
  "burcad badeed",
  "faraxumeyn",
  "tahriibiye",
  "isku dhac",
  "qalalaase",
  "hanjabaad",
  "hanjabaya",
  "cabsigelin",
  "bastoolad",
  "toogasho",
  "toogtay",
  "dhaawacyo",
  "dhaawacay",
  "dhaawacmay",
  "weerarkii",
  "hubeysan",
  "hubaysan",
  "is qarxin",
  "qarxis",
  "ladilay",
  "dilkaaga",
  "kufsaday",
  "afduubay",
  "weeraray",
  "dambiile",
  "danbiile",
  "dembiile",
  "xatooyo",
  "hanjabay",
  "mindiyo",
  "dilayaa",
  "qarxin",
  "qarxay",
  "bambo",
  "miino",
  "boobay",
  "burcad",
  "dabley",
  "rasaas",
  "xabad",
  "xabbad",
  "dhaawac",
  "weeraro",
  "laayay",
  "qisaas",
  "rabshad",
  "dagaal",
  "laaluush",
  "daroogo",
  "xashiish",
  "kokain",
  "heroine",
  "tahriib",
  "jidgooyo",
  "isbaaro",
  "burburiyay",
  "halaag",
  "gubay",
  "gubid",
  "daacish",
  "ak47",
  "kufsi",
  "afduub",
  "weerar",
  "werar",
  "toorey",
  "dileen",
  "dilay",
  "dilaa",
  "dilka",
  "dilid",
  "tuugo",
  "xaday",
  "boob",
  "qarax",
  "tuug",
  "qori",
  "hub",
  "bam",
  "dil",
  "dhac",
  "dambi",
  "danbi",
  "isis",
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectExtraTerms(matchedKeyword, blacklistMatches) {
  const extras = [];
  if (matchedKeyword) {
    String(matchedKeyword)
      .split(/[,|;/]+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 2)
      .forEach((part) => extras.push(part));
  }

  (blacklistMatches || []).forEach((match) => {
    [match?.value, match?.name, match?.type]
      .filter(Boolean)
      .forEach((value) => {
        const cleaned = String(value).trim();
        if (cleaned.length >= 2 && !/^https?:\/\//i.test(cleaned)) {
          extras.push(cleaned);
        }
      });
  });

  return extras;
}

function buildPattern(extraTerms = []) {
  const terms = [...CRIME_TERMS, ...extraTerms]
    .map((term) => String(term || "").trim())
    .filter(Boolean)
    // Longer phrases first so "fal dambiyeed" wins over "dil"
    .sort((a, b) => b.length - a.length);

  const unique = [];
  const seen = new Set();
  terms.forEach((term) => {
    const key = term.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(term);
  });

  if (!unique.length) return null;

  return {
    terms: unique,
    pattern: new RegExp(`(${unique.map(escapeRegExp).join("|")})`, "gi"),
  };
}

/**
 * Highlight crime keywords for evidence marking.
 * Decision (Crime / Not-crime) comes from the model; keywords only annotate the text.
 * @param {string} text
 * @param {boolean} isCrime
 * @param {{ matchedKeyword?: string, blacklistMatches?: array }} [options]
 */
export function renderCrimeHighlightedText(text, isCrime, options = {}) {
  const displayText = String(text || "");
  if (!displayText) return displayText;

  const extras = collectExtraTerms(
    options.matchedKeyword,
    options.blacklistMatches
  );

  // Crime decisions: highlight known crime terms + matched keyword.
  // Not-crime: still mark matchedKeyword if present (annotation only).
  const built = isCrime
    ? buildPattern(extras)
    : extras.length
      ? buildPatternFromTermsOnly(extras)
      : null;

  if (!built) return displayText;

  const termSet = new Set(built.terms.map((t) => t.toLowerCase()));

  return displayText.split(built.pattern).map((part, index) => {
    const isCrimeTerm = termSet.has(part.toLowerCase());
    return isCrimeTerm ? (
      <mark
        key={`${part}-${index}`}
        className="rounded bg-red-500/20 px-0.5 font-bold text-red-400"
        style={{ color: "var(--accent-danger, #f87171)" }}
      >
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${index}-${part.slice(0, 12)}`}>
        {part}
      </React.Fragment>
    );
  });
}

function buildPatternFromTermsOnly(terms = []) {
  const unique = [];
  const seen = new Set();
  [...terms]
    .map((term) => String(term || "").trim())
    .filter((term) => term.length >= 2)
    .sort((a, b) => b.length - a.length)
    .forEach((term) => {
      const key = term.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(term);
    });

  if (!unique.length) return null;

  return {
    terms: unique,
    pattern: new RegExp(`(${unique.map(escapeRegExp).join("|")})`, "gi"),
  };
}

export { CRIME_TERMS };
