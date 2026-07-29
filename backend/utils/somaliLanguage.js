/**
 * Accept Somali (Latin script) analysis text only.
 * Reject English and other languages so the crime model stays on-distribution.
 */

const ENGLISH_STOPWORDS = new Set([
  "the",
  "be",
  "to",
  "of",
  "and",
  "a",
  "in",
  "that",
  "have",
  "i",
  "it",
  "for",
  "not",
  "on",
  "with",
  "he",
  "as",
  "you",
  "do",
  "at",
  "this",
  "but",
  "his",
  "by",
  "from",
  "they",
  "we",
  "say",
  "her",
  "she",
  "or",
  "an",
  "will",
  "my",
  "one",
  "all",
  "would",
  "there",
  "their",
  "what",
  "so",
  "up",
  "out",
  "if",
  "about",
  "who",
  "get",
  "which",
  "go",
  "me",
  "when",
  "make",
  "can",
  "like",
  "time",
  "no",
  "just",
  "him",
  "know",
  "take",
  "people",
  "into",
  "year",
  "your",
  "good",
  "some",
  "could",
  "them",
  "see",
  "other",
  "than",
  "then",
  "now",
  "look",
  "only",
  "come",
  "its",
  "over",
  "think",
  "also",
  "back",
  "after",
  "use",
  "two",
  "how",
  "our",
  "work",
  "first",
  "well",
  "way",
  "even",
  "new",
  "want",
  "because",
  "any",
  "these",
  "give",
  "day",
  "most",
  "us",
  "is",
  "are",
  "was",
  "were",
  "been",
  "being",
  "has",
  "had",
  "did",
  "does",
  "am",
  "english",
  "hello",
  "please",
  "thank",
  "thanks",
  "today",
  "tomorrow",
  "yesterday",
  "police",
  "crime",
  "killed",
  "killing",
  "murder",
  "attack",
  "bomb",
  "shot",
  "shooting",
  "stolen",
  "steal",
  "robbery",
  "report",
  "reported",
  "happened",
  "someone",
  "something",
  "everywhere",
  "everything",
  "nothing",
  "always",
  "never",
  "where",
  "why",
  "while",
  "before",
  "during",
  "between",
  "through",
  "against",
  "without",
  "again",
  "still",
  "already",
  "maybe",
  "really",
  "very",
  "much",
  "many",
  "more",
  "such",
  "here",
  "those",
  "should",
  "shall",
  "must",
  "might",
  "need",
  "needs",
  "using",
  "used",
  "help",
  "find",
  "found",
  "call",
  "called",
]);

const SOMALI_MARKERS = new Set([
  "iyo",
  "oo",
  "ee",
  "ka",
  "ku",
  "la",
  "ay",
  "uu",
  "in",
  "si",
  "waa",
  "aan",
  "waxaa",
  "u",
  "ah",
  "waxa",
  "kale",
  "sida",
  "markii",
  "mar",
  "hadii",
  "haddii",
  "laakiin",
  "bal",
  "soo",
  "noqon",
  "noqday",
  "lagu",
  "waxay",
  "waxuu",
  "ama",
  "se",
  "xitaa",
  "inkastoo",
  "marka",
  "kadib",
  "baa",
  "ayaa",
  "ayuu",
  "ayay",
  "ayaan",
  "sidaas",
  "taas",
  "tan",
  "tani",
  "kaas",
  "kan",
  "kani",
  "waxba",
  "iyada",
  "isaga",
  "innaga",
  "idinka",
  "adiga",
  "aniga",
  "iyaga",
  "uma",
  "kuma",
  "lama",
  "ayna",
  "loo",
  "loogu",
  "ugu",
  "uga",
  "ahna",
  "ayaana",
  "soomaali",
  "soomaaliya",
  "muqdisho",
  "mogadishu",
  "banaadir",
  "dil",
  "dilay",
  "dileen",
  "dilka",
  "tuugo",
  "tuug",
  "xaday",
  "xatooyo",
  "qarax",
  "qarxay",
  "hanjabaad",
  "weerar",
  "weerarey",
  "afduub",
  "kufsi",
  "boolis",
  "booliska",
  "ciidanka",
  "maxkamad",
  "maxkamadda",
  "dambi",
  "dambiile",
  "fal",
  "dambiyeed",
  "shacabka",
  "magaalada",
  "degmada",
  "gobolka",
  "maanta",
  "berri",
  "shalay",
  "saaka",
  "habeen",
  "maalintii",
  "qof",
  "qofka",
  "dad",
  "dadka",
  "wiil",
  "gabadh",
  "haweeney",
  "nin",
  "naag",
  "caruur",
  "guriga",
  "baabuur",
  "baabuurka",
  "hub",
  "qori",
  "bastoolad",
  "miino",
  "bam",
  "lahaa",
  "lahayd",
  "yahay",
  "yihiin",
  "ahayd",
  "ahaa",
  "jira",
  "jirtay",
  "sameeyay",
  "sameeyeen",
  "qabtay",
  "qabteen",
  "dilkaaga",
  "la",
  "dhaawacay",
  "dhaawac",
  "geeriyooday",
  "dhacday",
  "dhacay",
  "sheegay",
  "sheegeen",
  "wararka",
  "warka",
  "xalay",
  "caawa",
  "subaxnimo",
  "galabnimo",
]);

const NUMBERS_NOT_ALLOWED_MESSAGE =
  "Qoraalku waa inuusan lahayn number ama tiro. Ka saar tirooyinka si analysis-ku u shaqeeyo.";

const SOMALI_ONLY_MESSAGE =
  "Fadlan geli qoraal Af Soomaali ah oo keliya. Ingiriis iyo luqadaha kale lama aqbalo — analysis-ku ma shaqeynayo.";

const tokenize = (text = "") => {
  const normalized = String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  return normalized.match(/[a-z']+/g) || [];
};

const nonLatinLetterRatio = (text = "") => {
  const letters = String(text).match(/\p{L}/gu) || [];
  if (!letters.length) return 0;
  const nonLatin = letters.filter((ch) => !/[a-zA-Z]/.test(ch));
  return nonLatin.length / letters.length;
};

const looksSomaliMorphology = (word) => {
  if (word.length < 4) return false;
  // Common Somali endings / clusters in Latin orthography
  return /(ay|een|aha|aha|ta|ka|ku|yo|yaa|ayna|aynaa|ayaan|ayaa|baa|doo|dha|xay|cay)$/.test(
    word
  );
};

/**
 * @returns {{ ok: true } | { ok: false, message: string, reason: string }}
 */
const assertSomaliOnly = (rawText = "", options = {}) => {
  const text = String(rawText || "").trim();

  if (!text) {
    return { ok: false, message: "Qoraalka waa loo baahan yahay.", reason: "empty" };
  }

  if (options.allowNumbers !== true && /\p{N}/u.test(text)) {
    return {
      ok: false,
      message: NUMBERS_NOT_ALLOWED_MESSAGE,
      reason: "numbers_not_allowed",
    };
  }

  if (nonLatinLetterRatio(text) > 0.08) {
    return {
      ok: false,
      message: SOMALI_ONLY_MESSAGE,
      reason: "non_latin_script",
    };
  }

  const words = tokenize(text).filter((w) => w.length >= 2);
  if (!words.length) {
    return {
      ok: false,
      message: SOMALI_ONLY_MESSAGE,
      reason: "no_words",
    };
  }

  let englishHits = 0;
  let somaliHits = 0;
  let morphHits = 0;

  for (const word of words) {
    if (ENGLISH_STOPWORDS.has(word)) englishHits += 1;
    if (SOMALI_MARKERS.has(word)) somaliHits += 1;
    if (looksSomaliMorphology(word)) morphHits += 1;
  }

  const somaliScore = somaliHits + morphHits * 0.5;
  const total = words.length;
  const englishRatio = englishHits / total;
  const somaliRatio = somaliScore / total;

  // Clear English-majority text
  if (englishHits >= 2 && englishRatio >= 0.2 && englishHits >= somaliHits) {
    return { ok: false, message: SOMALI_ONLY_MESSAGE, reason: "english_majority" };
  }

  if (englishHits >= 3 && englishHits > somaliScore) {
    return { ok: false, message: SOMALI_ONLY_MESSAGE, reason: "english_dense" };
  }

  // Enough words but no Somali signal
  if (total >= 5 && somaliScore < 1 && englishHits >= 1) {
    return { ok: false, message: SOMALI_ONLY_MESSAGE, reason: "no_somali_signal" };
  }

  if (total >= 8 && somaliRatio < 0.08) {
    return { ok: false, message: SOMALI_ONLY_MESSAGE, reason: "weak_somali" };
  }

  // Short pure English phrases like "he was killed"
  if (total <= 6 && englishHits >= 2 && somaliHits === 0) {
    return { ok: false, message: SOMALI_ONLY_MESSAGE, reason: "short_english" };
  }

  // Prefer Somali when scores compete
  if (somaliScore <= 0 && englishHits >= 1 && total >= 3) {
    return { ok: false, message: SOMALI_ONLY_MESSAGE, reason: "english_only" };
  }

  return { ok: true };
};

module.exports = {
  assertSomaliOnly,
  SOMALI_ONLY_MESSAGE,
  NUMBERS_NOT_ALLOWED_MESSAGE,
};
