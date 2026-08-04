"""Minimal local smoke test for the configured deployment model."""

from pathlib import Path

from model_runtime import ModelRuntime
from preprocessing import preprocess_text


runtime = ModelRuntime(Path(__file__).resolve().parent)
text = "Nin hubaysan ayaa qof ku dilay Muqdisho"
prediction = runtime.predict(text, preprocess_text(text))

print(
    {
        "model": runtime.selected_name,
        "backend": runtime.backend,
        "device": str(runtime.device),
        "prediction": prediction,
    }
)
