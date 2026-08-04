"""Load and run any model exported by the Colab all-model training notebook."""

from __future__ import annotations

import json
import os
from pathlib import Path

import joblib
import numpy as np


class ModelRuntime:
    def __init__(self, service_dir: Path):
        self.service_dir = service_dir
        self.artifact_dir = Path(
            os.getenv("AI_MODEL_ARTIFACT_DIR", str(service_dir))
        ).expanduser().resolve()
        self.selected_name = (os.getenv("AI_MODEL_NAME") or "").strip().lower()
        self.backend = "sklearn"
        self.max_length = 256
        self.model = None
        self.vectorizer = None
        self.tokenizer = None
        self.vocab = None
        self.model_file = None
        self._load()

    def _read_json(self, path: Path) -> dict:
        return json.loads(path.read_text(encoding="utf-8"))

    def _resolve_config(self) -> dict:
        available_path = self.artifact_dir / "available_models.json"
        active_path = self.artifact_dir / "active_model.json"

        if self.selected_name:
            if not available_path.is_file():
                if self.selected_name not in {"legacy", "classical"}:
                    raise RuntimeError(
                        f"AI_MODEL_NAME={self.selected_name!r} requires {available_path}."
                    )
                return {"selected_model": self.selected_name, "backend": "sklearn", "path": "."}
            available = self._read_json(available_path)
            if self.selected_name not in available:
                raise RuntimeError(
                    f"Unknown AI_MODEL_NAME={self.selected_name!r}; choose from {sorted(available)}."
                )
            return {"selected_model": self.selected_name, **available[self.selected_name]}

        if active_path.is_file():
            return self._read_json(active_path)

        return {"selected_model": "legacy", "backend": "sklearn", "path": "."}

    def _load(self) -> None:
        config = self._resolve_config()
        self.selected_name = str(config.get("selected_model", "legacy"))
        self.backend = str(config.get("backend", "sklearn"))
        model_dir = (self.artifact_dir / config.get("path", ".")).resolve()

        if self.backend == "sklearn":
            model_path = model_dir / config.get("model_file", "model.pkl")
            vectorizer_path = model_dir / config.get("vectorizer_file", "vectorizer.pkl")
            if not model_path.is_file() and self.selected_name == "legacy":
                model_path = self.artifact_dir / "crime_model.pkl"
            self.model = joblib.load(model_path)
            # Production inference is one document per request; avoid spawning a
            # joblib thread pool (which can be blocked by restricted Windows hosts).
            if hasattr(self.model, "n_jobs"):
                self.model.n_jobs = int(os.getenv("AI_MODEL_INFERENCE_JOBS", "1"))
            self.vectorizer = joblib.load(vectorizer_path)
            self.model_file = model_path
            return

        if self.backend == "transformer":
            try:
                import torch
                from transformers import AutoModelForSequenceClassification, AutoTokenizer
            except ImportError as exc:
                raise RuntimeError(
                    "Transformer deployment requires torch, transformers, and safetensors."
                ) from exc
            self.torch = torch
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            self.max_length = int(config.get("max_length", 256))
            self.tokenizer = AutoTokenizer.from_pretrained(model_dir, local_files_only=True)
            self.model = AutoModelForSequenceClassification.from_pretrained(
                model_dir, local_files_only=True
            ).to(self.device)
            self.model.eval()
            self.model_file = next(
                (p for p in (model_dir / "model.safetensors", model_dir / "pytorch_model.bin") if p.is_file()),
                model_dir / "config.json",
            )
            return

        if self.backend == "pytorch-word":
            self._load_word_model(model_dir)
            return

        raise RuntimeError(f"Unsupported model backend: {self.backend}")

    def _load_word_model(self, model_dir: Path) -> None:
        try:
            import torch
            import torch.nn as nn
        except ImportError as exc:
            raise RuntimeError("CNN/BiLSTM deployment requires torch.") from exc

        checkpoint = torch.load(model_dir / "model.pt", map_location="cpu", weights_only=False)
        params = checkpoint["params"]
        vocab_size = int(checkpoint["vocab_size"])

        class TextCNN(nn.Module):
            def __init__(self):
                super().__init__()
                embed_dim, channels = params["embed_dim"], params["channels"]
                self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
                self.convs = nn.ModuleList(
                    [nn.Conv1d(embed_dim, channels, k, padding=k // 2) for k in (3, 5, 7)]
                )
                self.dropout = nn.Dropout(params["dropout"])
                self.classifier = nn.Linear(channels * 3, 2)

            def forward(self, ids, lengths=None):
                features = [
                    torch.relu(conv(self.embedding(ids).transpose(1, 2))).amax(dim=2)
                    for conv in self.convs
                ]
                return self.classifier(self.dropout(torch.cat(features, dim=1)))

        class BiLSTM(nn.Module):
            def __init__(self):
                super().__init__()
                embed_dim, hidden_dim = params["embed_dim"], params["hidden_dim"]
                self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
                self.lstm = nn.LSTM(embed_dim, hidden_dim, batch_first=True, bidirectional=True)
                self.dropout = nn.Dropout(params["dropout"])
                self.classifier = nn.Linear(hidden_dim * 2, 2)

            def forward(self, ids, lengths):
                packed = nn.utils.rnn.pack_padded_sequence(
                    self.embedding(ids), lengths.cpu(), batch_first=True, enforce_sorted=False
                )
                _, (hidden, _) = self.lstm(packed)
                return self.classifier(
                    self.dropout(torch.cat([hidden[-2], hidden[-1]], dim=1))
                )

        self.torch = torch
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = (TextCNN() if self.selected_name == "1d-cnn" else BiLSTM()).to(self.device)
        self.model.load_state_dict(checkpoint["state_dict"])
        self.model.eval()
        self.vocab = joblib.load(model_dir / "vocab.pkl")
        self.max_length = int(checkpoint.get("max_length", 160))
        self.model_file = model_dir / "model.pt"

    def predict(self, raw_text: str, processed_text: str) -> tuple[str, float]:
        if self.backend == "sklearn":
            vector = self.vectorizer.transform([processed_text])
            prediction = str(self.model.predict(vector)[0])
            if hasattr(self.model, "predict_proba"):
                confidence = float(np.max(self.model.predict_proba(vector)[0]) * 100)
            elif hasattr(self.model, "decision_function"):
                score = float(np.ravel(self.model.decision_function(vector))[0])
                confidence = min(99.0, max(50.0, 50.0 + abs(score) * 10.0))
            else:
                confidence = 90.0
            return prediction, round(confidence, 2)

        if self.backend == "transformer":
            encoded = self.tokenizer(
                raw_text, truncation=True, max_length=self.max_length,
                padding=True, return_tensors="pt"
            )
            encoded = {key: value.to(self.device) for key, value in encoded.items()}
            with self.torch.inference_mode():
                logits = self.model(**encoded).logits
                probabilities = self.torch.softmax(logits, dim=-1)[0]
            class_id = int(probabilities.argmax().item())
            label = self.model.config.id2label.get(class_id, str(class_id))
            return str(label), round(float(probabilities[class_id].item() * 100), 2)

        tokens = processed_text.split()[: self.max_length]
        ids = [self.vocab.get(token, 1) for token in tokens] or [1]
        ids_tensor = self.torch.tensor([ids], dtype=self.torch.long, device=self.device)
        lengths = self.torch.tensor([len(ids)], dtype=self.torch.long, device=self.device)
        with self.torch.inference_mode():
            logits = self.model(ids_tensor, lengths)
            probabilities = self.torch.softmax(logits, dim=-1)[0]
        class_id = int(probabilities.argmax().item())
        label = "crime-related" if class_id == 1 else "not crime-related"
        return label, round(float(probabilities[class_id].item() * 100), 2)
