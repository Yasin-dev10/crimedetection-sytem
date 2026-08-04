"""High-precision Somali crime-event rules used alongside the ML classifier."""

from __future__ import annotations

import re


NON_EVENT_CONTEXT = re.compile(
    r"\b(filim\w*|riwaayad\w*|sheeko\w*|buug\w*|taariikh\w*|tusaale|"
    r"war\s+been\s+abuur|been\s+abuur\s+ah|ma\s+dhicin)\b",
    re.IGNORECASE,
)

CRIME_EVENT_PATTERNS = [
    ("dil", r"\b(?:qof|nin|naag|gabadh|wiil|askari|dad)?\s*(?:ayaa\s+)?(?:la\s+)?(?:dilay|dileen|toogtay|toogteen|laayay)\b"),
    ("qarax", r"\b(?:qarax|bam|bambo|miino)\w*\b.{0,70}\b(?:dhacay|qarxay|qarxiyey|qarxiyay|dilay|dhaawac\w*|burbur\w*)\b"),
    ("weerar", r"\b(?:koox\s+)?(?:hubeysan|hubaysan)?\s*(?:ayaa\s+)?(?:weerartay|weeraray|weerareen|la\s+weeraray)\b"),
    ("afduub", r"\b(?:la\s+)?(?:afduubay|afduubtay|afduubeen|la\s+afduubay)\b"),
    ("kufsi", r"\b(?:la\s+)?(?:kufsaday|kufsatay|kufsadeen|la\s+kufsaday)\b"),
    ("xatooyo", r"\b(?:tuug|tuugo)\b.{0,60}\b(?:xaday|xadeen|boobay|boobeen)\b|\b(?:xaday|xadeen|la\s+xaday)\b"),
    ("hanjabaad", r"\b(?:hanjabay|hanjabtay|hanjabeen|waan\s+ku\s+dili|ku\s+dili\s+doonaa)\b"),
]


def find_explicit_crime_event(text: str) -> str | None:
    """Return the category only when text describes a concrete crime event."""
    normalized = " ".join(str(text or "").lower().split())
    if not normalized or NON_EVENT_CONTEXT.search(normalized):
        return None
    for category, pattern in CRIME_EVENT_PATTERNS:
        if re.search(pattern, normalized, re.IGNORECASE):
            return category
    return None


def has_non_event_context(text: str) -> bool:
    return bool(NON_EVENT_CONTEXT.search(str(text or "")))
