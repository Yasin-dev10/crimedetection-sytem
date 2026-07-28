"""Shared Somali text preprocessing for training and production inference.

Stopword list includes the rich set from model/model sax.ipynb plus built-ins.
Cleaning also adopts sax practices: URLs, @mentions, #hashtags, digits.
"""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

_FALLBACK_STOPWORDS = {
    "iyo", "oo", "ee", "ka", "ku", "la", "ay", "uu", "in", "si", "waa",
    "aan", "waxaa", "u", "ah", "waxa", "kale", "sida", "markii", "mar",
    "hadii", "haddii", "laakiin", "bal", "soo", "noqon", "noqday", "lagu",
    "waxay", "waxuu", "waxyaabaha", "cidda", "ama", "se", "xitaa", "hase",
    "yeeshee", "inkastoo", "marka", "kadib", "horeba", "jeer", "kasta",
    "midna", "mid", "baa", "ayaa", "ayuu", "ayay", "ayaan", "sidaas",
    "taas", "tan", "tani", "taasi", "kaas", "kan", "kani", "kaasi",
    "waxba", "marna", "weligeed", "weligii", "iyada", "isaga", "innaga",
    "idinka", "adiga", "aniga", "iyaga", "uma", "kuma", "lama", "ayna",
    "loo", "loogu", "ugu", "uga", "ahna", "ayaana",
}


@lru_cache(maxsize=1)
def load_somali_stopwords() -> frozenset[str]:
    """Load stopwords: JSON (from model sax) > Excel > built-in fallback."""
    base = Path(__file__).resolve().parent
    model_dir = base.parent / "model"
    json_candidates = [
        base / "somali_stopwords.json",
        model_dir / "somali_stopwords.json",
        model_dir / "_sax_stopwords.json",
    ]
    for path in json_candidates:
        if path.exists():
            try:
                words = json.loads(path.read_text(encoding="utf-8"))
                return frozenset(
                    str(w).strip().lower().strip("'")
                    for w in words
                    if str(w).strip() and str(w).strip().lower() != "nan"
                )
            except Exception:
                continue

    for path in [model_dir / "stopwords.xlsx", base / "stopwords.xlsx"]:
        if not path.exists():
            continue
        try:
            import pandas as pd

            stopwords_df = pd.read_excel(path)
            col = "Stoppwords" if "Stoppwords" in stopwords_df.columns else stopwords_df.columns[0]
            words = (
                stopwords_df[col]
                .astype(str)
                .str.strip()
                .str.lower()
                .str.strip("'")
                .tolist()
            )
            return frozenset(w for w in words if w and w != "nan")
        except Exception:
            continue

    return frozenset(_FALLBACK_STOPWORDS)


def clean_text(text: str) -> str:
    """Normalize raw Somali/Latin text (training + API).

    Combines Automatic_crime cleaning with model-sax rules:
    HTML, URLs, emails, @mentions, #hashtags, digits, non-letters.
    """
    if text is None:
        return ""
    text = str(text).lower()
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"http\S+|www\S+|https\S+", " ", text, flags=re.MULTILINE)
    text = re.sub(r"\S+@\S+", " ", text)
    text = re.sub(r"@\w+", " ", text)
    text = re.sub(r"#\w+", " ", text)
    text = re.sub(r"\d+", " ", text)
    # Keep Latin letters, Somali apostrophe, and spaces
    text = re.sub(r"[^a-z'\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def preprocess_text(text: str, remove_stopwords: bool = True) -> str:
    """Full preprocessing used by training notebook and Flask API."""
    text = clean_text(text)
    tokens = text.split()
    if remove_stopwords:
        stopwords = load_somali_stopwords()
        tokens = [tok for tok in tokens if tok.strip("'") not in stopwords and len(tok) > 1]
    return " ".join(tokens)
