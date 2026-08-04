"""Accept Somali (Latin) text only for crime analysis."""

from __future__ import annotations

import re
import unicodedata

NUMBERS_NOT_ALLOWED_MESSAGE = (
    "Qoraalku waa inuusan lahayn number ama tiro. "
    "Ka saar tirooyinka si analysis-ku u shaqeeyo."
)

SOMALI_ONLY_MESSAGE = (
    "Fadlan geli qoraal Af Soomaali ah oo keliya. "
    "Ingiriis iyo luqadaha kale lama aqbalo — analysis-ku ma shaqeynayo."
)

ENGLISH_STOPWORDS = {
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
}

SOMALI_MARKERS = {
    "iyo", "oo", "ee", "ka", "ku", "la", "ay", "uu", "in", "si", "waa", "aan",
    "waxaa", "u", "ah", "waxa", "kale", "sida", "markii", "mar", "hadii", "haddii",
    "laakiin", "bal", "soo", "lagu", "waxay", "waxuu", "ama", "baa", "ayaa", "ayuu",
    "ayay", "ayaan", "taas", "tan", "tani", "kaas", "kan", "loo", "ugu", "uga",
    "soomaali", "soomaaliya", "muqdisho", "banaadir", "dil", "dilay", "dileen",
    "tuugo", "tuug", "xaday", "xatooyo", "qarax", "hanjabaad", "weerar", "afduub",
    "kufsi", "boolis", "booliska", "dambi", "dambiile", "magaalada", "degmada",
    "maanta", "berri", "shalay", "qof", "dadka", "yahay", "yihiin", "ahayd",
    "ahaa", "dhacday", "dhacay", "sheegay", "wararka", "xalay", "caawa",
}

_MORPH = re.compile(r"(ay|een|aha|ta|ka|ku|yo|yaa|ayna|ayaan|ayaa|baa|dha|xay|cay)$")


def _tokenize(text: str) -> list[str]:
    normalized = unicodedata.normalize("NFKD", str(text).lower())
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.findall(r"[a-z']+", normalized)


def _non_latin_ratio(text: str) -> float:
    letters = [ch for ch in text if ch.isalpha()]
    if not letters:
        return 0.0
    non_latin = [ch for ch in letters if ord(ch) > 127 or not ("a" <= ch.lower() <= "z")]
    # Latin letters only a-z; anything else counts as non-latin for our purpose
    non_latin = [ch for ch in letters if not ("a" <= ch.lower() <= "z")]
    return len(non_latin) / len(letters)


def assert_somali_only(raw_text: str = "") -> dict:
    text = str(raw_text or "").strip()
    if not text:
        return {"ok": False, "message": "Qoraalka waa loo baahan yahay.", "reason": "empty"}

    if any(ch.isdigit() for ch in text):
        return {
            "ok": False,
            "message": NUMBERS_NOT_ALLOWED_MESSAGE,
            "reason": "numbers_not_allowed",
        }

    if _non_latin_ratio(text) > 0.08:
        return {"ok": False, "message": SOMALI_ONLY_MESSAGE, "reason": "non_latin_script"}

    words = [w for w in _tokenize(text) if len(w) >= 2]
    if not words:
        return {"ok": False, "message": SOMALI_ONLY_MESSAGE, "reason": "no_words"}

    english_hits = 0
    somali_hits = 0
    morph_hits = 0
    for word in words:
        if word in ENGLISH_STOPWORDS:
            english_hits += 1
        if word in SOMALI_MARKERS:
            somali_hits += 1
        if len(word) >= 4 and _MORPH.search(word):
            morph_hits += 1

    somali_score = somali_hits + morph_hits * 0.5
    total = len(words)
    english_ratio = english_hits / total

    if english_hits >= 2 and english_ratio >= 0.2 and english_hits >= somali_hits:
        return {"ok": False, "message": SOMALI_ONLY_MESSAGE, "reason": "english_majority"}
    if english_hits >= 3 and english_hits > somali_score:
        return {"ok": False, "message": SOMALI_ONLY_MESSAGE, "reason": "english_dense"}
    if total >= 5 and somali_score < 1 and english_hits >= 1:
        return {"ok": False, "message": SOMALI_ONLY_MESSAGE, "reason": "no_somali_signal"}
    if total >= 8 and somali_score / total < 0.08:
        return {"ok": False, "message": SOMALI_ONLY_MESSAGE, "reason": "weak_somali"}
    if total <= 6 and english_hits >= 2 and somali_hits == 0:
        return {"ok": False, "message": SOMALI_ONLY_MESSAGE, "reason": "short_english"}
    if somali_score <= 0 and english_hits >= 1 and total >= 3:
        return {"ok": False, "message": SOMALI_ONLY_MESSAGE, "reason": "english_only"}

    return {"ok": True}
