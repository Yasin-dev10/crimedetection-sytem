from flask import Flask, request, jsonify
from flask_cors import CORS
import hashlib
import json
import os
import re
import subprocess
from functools import wraps
from pathlib import Path


MODEL_DIR = Path(__file__).resolve().parent


def run_transformer_in_wsl_when_needed() -> None:
    """Delegate direct Windows launches to the Linux PyTorch runtime."""
    if os.name != "nt" or __name__ != "__main__":
        return

    active_path = MODEL_DIR / "active_model.json"
    if not active_path.is_file():
        return

    active_model = json.loads(active_path.read_text(encoding="utf-8"))
    if active_model.get("backend") != "transformer":
        return

    launcher = MODEL_DIR / "start-somberta.ps1"
    print("SomBERTa-B requires Linux PyTorch; starting it automatically in WSL...")
    result = subprocess.run(
        [
            "powershell.exe",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(launcher),
        ],
        check=False,
    )
    raise SystemExit(result.returncode)


run_transformer_in_wsl_when_needed()

from preprocessing import preprocess_text
from crime_rules import find_explicit_crime_event, has_non_event_context
from model_runtime import ModelRuntime
from somali_language import assert_somali_only


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


load_env_file(MODEL_DIR / ".env")
load_env_file(MODEL_DIR.parent / "backend" / ".env")

app = Flask(__name__)

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_URL", "http://localhost:5173").split(",")
    if origin.strip()
]
CORS(app, resources={r"/*": {"origins": ALLOWED_ORIGINS or ["http://localhost:5173"]}})

AI_MODEL_API_KEY = (os.getenv("AI_MODEL_API_KEY") or "").strip()
EXPECTED_MODEL_SHA256 = (os.getenv("AI_MODEL_SHA256") or "").strip().lower()

TRAINING_DIR = MODEL_DIR.parent / "model"


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


runtime = ModelRuntime(MODEL_DIR)
MODEL_SHA256 = file_sha256(runtime.model_file)
if EXPECTED_MODEL_SHA256 and MODEL_SHA256 != EXPECTED_MODEL_SHA256:
    raise RuntimeError(
        "Model integrity check failed. Update AI_MODEL_SHA256 or restore crime_model.pkl."
    )

SOMALI_LOCATIONS = [
    {"district_or_city": "hodan", "city": "muqdisho", "region": "banaadir"},
    {"district_or_city": "yaaqshiid", "city": "muqdisho", "region": "banaadir"},
    {"district_or_city": "wadajir", "city": "muqdisho", "region": "banaadir"},
    {"district_or_city": "dharkenley", "city": "muqdisho", "region": "banaadir"},
    {"district_or_city": "daynile", "city": "muqdisho", "region": "banaadir"},
    {"district_or_city": "xamar weyne", "city": "muqdisho", "region": "banaadir"},
    {"district_or_city": "xamar jajab", "city": "muqdisho", "region": "banaadir"},
    {"district_or_city": "kaaraan", "city": "muqdisho", "region": "banaadir"},
    {"district_or_city": "shibis", "city": "muqdisho", "region": "banaadir"},
    {"district_or_city": "boondheere", "city": "muqdisho", "region": "banaadir"},
    {"district_or_city": "waaberi", "city": "muqdisho", "region": "banaadir"},
    {"district_or_city": "wardhiigley", "city": "muqdisho", "region": "banaadir"},
    {"district_or_city": "kismaayo", "city": "kismaayo", "region": "jubbada hoose"},
    {"district_or_city": "baydhabo", "city": "baydhabo", "region": "bay"},
    {"district_or_city": "balcad", "city": "balcad", "region": "shabeellaha dhexe"},
    {"district_or_city": "jowhar", "city": "jowhar", "region": "shabeellaha dhexe"},
    {"district_or_city": "beledweyne", "city": "beledweyne", "region": "hiiraan"},
    {"district_or_city": "gaalkacyo", "city": "gaalkacyo", "region": "mudug"},
    {"district_or_city": "garowe", "city": "garowe", "region": "nugaal"},
    {"district_or_city": "hargeysa", "city": "hargeysa", "region": "woqooyi galbeed"},
    {"district_or_city": "boosaaso", "city": "boosaaso", "region": "bari"},
]


def require_api_key(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if AI_MODEL_API_KEY:
            provided = request.headers.get("X-API-Key", "")
            if provided != AI_MODEL_API_KEY:
                return jsonify({"message": "Unauthorized"}), 401
        return view(*args, **kwargs)

    return wrapped


def find_locations(text):
    text_lower = text.lower()
    matches = []

    for location in SOMALI_LOCATIONS:
        pattern = r"\b" + re.escape(location["district_or_city"]) + r"\b"
        if re.search(pattern, text_lower):
            matches.append(location)

    return matches


def is_crime_prediction(prediction):
    return str(prediction).strip().lower() in [
        "crime",
        "crime-related",
        "crime related",
        "criminal",
        "1",
        "yes",
        "true",
    ]


CRIME_KEYWORD_PATTERNS = [
    ("dil", r"\b(dil|dilay|dileen|dilaa|dilayaa|dilka|dilid|dilkaaga)\b"),
    ("hanjabaad", r"\b(hanjabaad|hanjabay|hanjabaya|cabsi gelin|cabsigelin)\b"),
    ("qarax", r"\b(qarax|qarxay|qarxin|bam|bambo|miino)\b"),
    ("tuugo", r"\b(tuugo|tuug|xatooyo|xaday|la xaday|boob|boobay)\b"),
    ("kufsi", r"\b(kufsi|kufsaday|la kufsaday)\b"),
    ("afduub", r"\b(afduub|afduubay|la afduubay)\b"),
    ("weerar", r"\b(weerar|weeraray|la weeraray)\b"),
    ("hub", r"\b(bastoolad|qori|hub|mindiyo|toorey)\b"),
    ("fal dambiyeed", r"\b(fal dambiyeed|fal danbiyeed|dambiile|danbiile)\b"),
]


def find_crime_keyword(text):
    text_lower = text.lower()

    for keyword, pattern in CRIME_KEYWORD_PATTERNS:
        if re.search(pattern, text_lower):
            return keyword

    return None


def make_response(text):
    locations = find_locations(text)
    matched_keyword = find_crime_keyword(text)
    explicit_event = find_explicit_crime_event(text)

    processed = preprocess_text(text)
    prediction, confidence = runtime.predict(text, processed)

    # Decision comes from the ML model only.
    # Keywords are detected afterwards for marking / evidence labels — they do not override.
    model_is_crime = is_crime_prediction(prediction)
    non_event_context = has_non_event_context(text)
    is_crime = model_is_crime or explicit_event is not None
    decision_source = "model"
    if explicit_event is not None and not model_is_crime:
        decision_source = "explicit-crime-event"
        confidence = 92.0
    elif non_event_context:
        is_crime = False
        decision_source = "non-event-context"
        confidence = 95.0

    normalized_prediction = "crime-related" if is_crime else "not crime-related"

    return {
        "prediction": normalized_prediction,
        "rawPrediction": prediction,
        "modelPrediction": prediction,
        "confidence": confidence,
        "isCrime": is_crime,
        "is_crime": is_crime,
        "matchedKeyword": matched_keyword,
        "matched_keyword": matched_keyword,
        "keywordMarked": matched_keyword is not None,
        "explicitCrimeEvent": explicit_event,
        "location": locations,
        "locations": locations,
        "model_loaded": True,
        "modelName": runtime.selected_name,
        "modelBackend": runtime.backend,
        "decisionSource": decision_source,
        "decision": "CRIME" if is_crime else "NOT_CRIME",
    }


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "message": "AI Model Running",
        "modelLoaded": True,
        "modelName": runtime.selected_name,
        "modelBackend": runtime.backend,
        "modelIntegrity": MODEL_SHA256[:12],
    })


@app.route("/api/model/info", methods=["GET"])
@require_api_key
def model_info():
    return jsonify({
        "status": "ok",
        "modelLoaded": True,
        "features": ["text", "url", "file", "batch"],
        "predictEndpoint": "/predict",
        "modelIntegrity": MODEL_SHA256[:12],
        "modelName": runtime.selected_name,
        "modelBackend": runtime.backend,
    })


@app.route("/predict", methods=["POST"])
@require_api_key
def predict():
    data = request.get_json(silent=True) or {}
    text = data.get("text", "")

    if not text or not text.strip():
        return jsonify({"message": "Qoraalka waa loo baahan yahay."}), 400

    language_check = assert_somali_only(text)
    if not language_check.get("ok"):
        return jsonify({
            "message": language_check.get("message"),
            "languageRejected": True,
            "reason": language_check.get("reason"),
        }), 400

    return jsonify(make_response(text))


@app.route("/api/classify/text", methods=["POST"])
@require_api_key
def classify_text():
    return predict()


if __name__ == "__main__":
    host = os.getenv("AI_MODEL_HOST", "127.0.0.1")
    port = int(os.getenv("AI_MODEL_PORT", "5001"))
    debug = os.getenv("AI_MODEL_DEBUG", "false").lower() == "true"
    app.run(host=host, port=port, debug=debug)
