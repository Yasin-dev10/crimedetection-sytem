const ENGLISH_STOPWORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for",
  "not", "on", "with", "he", "as", "you", "do", "at", "this", "but", "his", "by",
  "from", "they", "we", "say", "her", "she", "or", "an", "will", "my", "one",
  "all", "would", "there", "their", "what", "so", "up", "out", "if", "about",
  "who", "get", "which", "go", "me", "when", "make", "can", "like", "time", "no",
  "just", "him", "know", "take", "people", "into", "year", "your", "good", "some",
  "could", "them", "see", "other", "than", "then", "now", "look", "only", "come",
  "its", "over", "think", "also", "back", "after", "use", "two", "how", "our",
  "work", "first", "well", "way", "even", "new", "want", "because", "any", "these",
  "give", "day", "most", "us", "is", "are", "was", "were", "been", "being", "has",
  "had", "did", "does", "am", "english", "hello", "please", "thank", "thanks",
  "today", "police", "crime", "killed", "killing", "murder", "attack", "bomb",
  "shot", "stolen", "report", "happened", "someone", "something", "always",
  "never", "where", "why", "should", "must", "help", "find", "found", "call",
  "useful", "skill", "skills",
  "analysis", "analys", "analyse", "analyze", "analysed", "analyzed",
]);

const SOMALI_MARKERS = new Set([
  "iyo", "oo", "ee", "ka", "ku", "la", "ay", "uu", "in", "si", "waa", "aan",
  "waxaa", "u", "ah", "waxa", "kale", "sida", "markii", "mar", "hadii", "haddii",
  "laakiin", "bal", "soo", "lagu", "waxay", "waxuu", "ama", "baa", "ayaa", "ayuu",
  "ayay", "ayaan", "taas", "tan", "tani", "kaas", "kan", "loo", "ugu", "uga",
  "soomaali", "soomaaliya", "muqdisho", "banaadir", "dil", "dilay", "dileen",
  "tuugo", "tuug", "xaday", "xatooyo", "qarax", "hanjabaad", "weerar", "afduub",
  "kufsi", "boolis", "booliska", "dambi", "dambiile", "magaalada", "degmada",
  "maanta", "berri", "shalay", "qof", "dadka", "yahay", "yihiin", "ahayd",
  "ahaa", "dhacday", "dhacay", "sheegay", "wararka", "xalay", "caawa",
]);

export const NUMBERS_NOT_ALLOWED_MESSAGE =
  "Qoraalku waa inuusan lahayn number ama tiro. Ka saar tirooyinka si analysis-ku u shaqeeyo.";

const LEGACY_SOMALI_ONLY_MESSAGE =
  "Fadlan geli qoraal Af Soomaali ah oo keliya. Ingiriis iyo luqadaha kale lama aqbalo — analysis-ku ma shaqeynayo.";

export const SOMALI_ONLY_MESSAGE =
  "Qoraalka waxaa ku jira eray English ah. Fadlan ka saar qoraalka English-ka si analysis-ku u shaqeeyo.";
void LEGACY_SOMALI_ONLY_MESSAGE;

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

const looksSomaliMorphology = (word) =>
  word.length >= 4 &&
  /(ay|een|aha|ta|ka|ku|yo|yaa|ayna|ayaan|ayaa|baa|dha|xay|cay)$/.test(word);

export function assertSomaliOnly(rawText = "") {
  const text = String(rawText || "").trim();
  if (!text) {
    return { ok: false, message: "Qoraalka waa loo baahan yahay." };
  }

  if (/\p{N}/u.test(text)) {
    return {
      ok: false,
      message: NUMBERS_NOT_ALLOWED_MESSAGE,
      reason: "numbers_not_allowed",
    };
  }

  if (nonLatinLetterRatio(text) > 0.08) {
    return { ok: false, message: SOMALI_ONLY_MESSAGE };
  }

  const words = tokenize(text).filter((w) => w.length >= 2);
  if (!words.length) {
    return { ok: false, message: SOMALI_ONLY_MESSAGE };
  }

  let englishHits = 0;
  let somaliHits = 0;
  let morphHits = 0;
  const englishWords = [];

  for (const word of words) {
    // Words shared by both languages (for example "in") are Somali here.
    if (ENGLISH_STOPWORDS.has(word) && !SOMALI_MARKERS.has(word)) {
      englishHits += 1;
      englishWords.push(word);
    }
    if (SOMALI_MARKERS.has(word)) somaliHits += 1;
    if (looksSomaliMorphology(word)) morphHits += 1;
  }

  const somaliScore = somaliHits + morphHits * 0.5;
  const total = words.length;
  const englishRatio = englishHits / total;

  // Mixed Somali/English input is not allowed: one clear English word is enough.
  if (englishWords.length > 0) {
    return {
      ok: false,
      message: SOMALI_ONLY_MESSAGE,
      reason: "english_word_detected",
    };
  }

  if (englishHits >= 2 && englishRatio >= 0.2 && englishHits >= somaliHits) {
    return { ok: false, message: SOMALI_ONLY_MESSAGE };
  }
  if (englishHits >= 3 && englishHits > somaliScore) {
    return { ok: false, message: SOMALI_ONLY_MESSAGE };
  }
  if (total >= 5 && somaliScore < 1 && englishHits >= 1) {
    return { ok: false, message: SOMALI_ONLY_MESSAGE };
  }
  if (total >= 8 && somaliScore / total < 0.08) {
    return { ok: false, message: SOMALI_ONLY_MESSAGE };
  }
  if (total <= 6 && englishHits >= 2 && somaliHits === 0) {
    return { ok: false, message: SOMALI_ONLY_MESSAGE };
  }
  if (somaliScore <= 0 && englishHits >= 1 && total >= 3) {
    return { ok: false, message: SOMALI_ONLY_MESSAGE };
  }

  return { ok: true };
}
