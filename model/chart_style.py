"""Clear, dataset-linked chart helpers for the Somali crime detection dataset."""

from __future__ import annotations

from collections import Counter
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from wordcloud import WordCloud

# Fixed class colors — same meaning on every chart
COLOR_CRIME = "#b91c1c"      # red = crime-related
COLOR_SAFE = "#1d4ed8"       # blue = not crime-related
COLOR_NEUTRAL = "#334155"
COLOR_ACCENT = "#0f766e"

LABEL_CRIME = "crime-related"
LABEL_SAFE = "not crime-related"

# Human-readable Somali + English labels for axes/legends
DISPLAY = {
    LABEL_CRIME: "Dambi leh\n(crime-related)",
    LABEL_SAFE: "Ma ahan dambi\n(not crime-related)",
}
DISPLAY_ONE_LINE = {
    LABEL_CRIME: "Dambi leh (crime-related)",
    LABEL_SAFE: "Ma ahan dambi (not crime-related)",
}


def dataset_caption(df: pd.DataFrame, extra: str = "") -> str:
    n = len(df)
    n_c = int((df["category"] == LABEL_CRIME).sum()) if "category" in df.columns else 0
    n_s = int((df["category"] == LABEL_SAFE).sum()) if "category" in df.columns else 0
    base = f"Dataset: dataset.csv.csv  |  Wadar: {n:,} qoraal  |  Dambi: {n_c:,}  |  Ma ahan: {n_s:,}"
    return f"{base}  |  {extra}" if extra else base


def _finish(fig, path: Path, caption: str):
    fig.text(0.5, 0.01, caption, ha="center", va="bottom", fontsize=9, color="#475569")
    fig.tight_layout(rect=[0, 0.04, 1, 1])
    path.parent.mkdir(exist_ok=True)
    fig.savefig(path, dpi=200, bbox_inches="tight")
    plt.close(fig)
    print("Saved:", path.name)


def plot_duplicates(n_dupes: int, n_unique: int, out: Path, caption: str):
    """Show how many repeated texts were in YOUR dataset before cleaning."""
    fig, ax = plt.subplots(figsize=(8, 4.5))
    labels = ["Qoraal duplicate\n(isku mid ah)", "Qoraal unique\n(kala duwan)"]
    vals = [n_dupes, n_unique]
    bars = ax.bar(labels, vals, color=["#dc2626", "#16a34a"], edgecolor="black", width=0.55)
    ax.set_title("Dataset-kaaga: Qoraalada isku midka ah vs kuwa kala duwan", fontsize=13, fontweight="bold")
    ax.set_ylabel("Tirada qoraalada")
    for bar, v in zip(bars, vals):
        ax.text(bar.get_x() + bar.get_width() / 2, v, f"{v:,}", ha="center", va="bottom", fontweight="bold")
    ax.set_ylim(0, max(vals) * 1.15)
    note = f"Duplicate-yada waa la tirtiray ka hor training. {caption}"
    _finish(fig, out, note)


def plot_category_balance(df: pd.DataFrame, out: Path):
    """Bar + pie: how many crime vs not-crime documents in YOUR file."""
    order = [LABEL_CRIME, LABEL_SAFE]
    counts = df["category"].value_counts().reindex(order).fillna(0).astype(int)
    colors = [COLOR_CRIME, COLOR_SAFE]
    labels = [DISPLAY[c] for c in order]

    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    bars = axes[0].bar(labels, counts.values, color=colors, edgecolor="black", width=0.55)
    axes[0].set_title("Tirada qoraalada dataset-kaaga (labada class)", fontweight="bold")
    axes[0].set_ylabel("Tirada documents")
    axes[0].set_xlabel("Nooca qoraalka (label)")
    for bar, v in zip(bars, counts.values):
        pct = 100 * v / max(counts.sum(), 1)
        axes[0].text(
            bar.get_x() + bar.get_width() / 2,
            v,
            f"{v:,}\n({pct:.1f}%)",
            ha="center",
            va="bottom",
            fontsize=10,
            fontweight="bold",
        )
    axes[0].set_ylim(0, max(counts.values) * 1.22)

    axes[1].pie(
        counts.values,
        labels=[DISPLAY_ONE_LINE[c] for c in order],
        autopct="%1.1f%%",
        colors=colors,
        startangle=90,
        explode=(0.03, 0.03),
        textprops={"fontsize": 9},
    )
    axes[1].set_title("Saamiga (%) — crime vs not-crime", fontweight="bold")
    _finish(fig, out, dataset_caption(df, "Balance chart"))


def plot_text_length(df: pd.DataFrame, out: Path):
    """Histogram + averages: document length by class in YOUR dataset."""
    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    for cat, color, name in [
        (LABEL_CRIME, COLOR_CRIME, DISPLAY_ONE_LINE[LABEL_CRIME]),
        (LABEL_SAFE, COLOR_SAFE, DISPLAY_ONE_LINE[LABEL_SAFE]),
    ]:
        subset = df.loc[df["category"] == cat, "word_count"]
        axes[0].hist(subset, bins=30, alpha=0.55, label=name, color=color, edgecolor="black")
    axes[0].set_title("Dhererka qoraalka: word count by class", fontweight="bold")
    axes[0].set_xlabel("Tirada erayada (kadib preprocessing)")
    axes[0].set_ylabel("Frequency (documents)")
    axes[0].legend(fontsize=8)

    crime = df[df["category"] == LABEL_CRIME]
    safe = df[df["category"] == LABEL_SAFE]
    metrics = ["Celcelis erayo\n(word count)", "Celcelis xaraf\n(chars cleaned)"]
    crime_vals = [crime["word_count"].mean(), crime["sentence_length"].mean()]
    safe_vals = [safe["word_count"].mean(), safe["sentence_length"].mean()]
    x = np.arange(len(metrics))
    w = 0.35
    b1 = axes[1].bar(x - w / 2, crime_vals, w, label=DISPLAY_ONE_LINE[LABEL_CRIME], color=COLOR_CRIME, edgecolor="black")
    b2 = axes[1].bar(x + w / 2, safe_vals, w, label=DISPLAY_ONE_LINE[LABEL_SAFE], color=COLOR_SAFE, edgecolor="black")
    axes[1].set_xticks(x)
    axes[1].set_xticklabels(metrics)
    axes[1].set_ylabel("Celceliska qiimaha")
    axes[1].set_title("Isbarbardhig dherer: Dambi vs Ma ahan dambi", fontweight="bold")
    axes[1].legend(fontsize=8)
    for bars in (b1, b2):
        for bar in bars:
            axes[1].text(
                bar.get_x() + bar.get_width() / 2,
                bar.get_height(),
                f"{bar.get_height():.0f}",
                ha="center",
                va="bottom",
                fontsize=9,
            )
    _finish(fig, out, dataset_caption(df, "Length analysis"))


def plot_top_words_by_class(df: pd.DataFrame, out: Path, n: int = 15):
    """Top words that appear in crime vs not-crime texts in YOUR data."""

    def top_n(texts, k):
        c = Counter()
        for t in texts:
            c.update(str(t).split())
        return c.most_common(k)

    fig, axes = plt.subplots(1, 2, figsize=(15, 6))
    specs = [
        (LABEL_CRIME, COLOR_CRIME, "Erayada ugu badan — qoraalada DAMBI leh"),
        (LABEL_SAFE, COLOR_SAFE, "Erayada ugu badan — qoraalada AAN dambi ahayn"),
    ]
    for ax, (cat, color, title) in zip(axes, specs):
        items = top_n(df.loc[df["category"] == cat, "preprocessed_text"], n)
        labels = [w for w, _ in items][::-1]
        vals = [c for _, c in items][::-1]
        ax.barh(labels, vals, color=color, edgecolor="black")
        ax.set_title(title, fontweight="bold", fontsize=11)
        ax.set_xlabel("Inta jeer ee eraygu ka soo muuqday (frequency)")
        for y, v in enumerate(vals):
            ax.text(v, y, f" {v:,}", va="center", fontsize=8)
    _finish(fig, out, dataset_caption(df, "Top words after Somali stopword removal"))


def plot_word_freq_and_length(df: pd.DataFrame, out: Path):
    """Overall vocabulary peek for YOUR cleaned Somali corpus."""
    all_words = " ".join(df["preprocessed_text"]).split()
    common = Counter(all_words).most_common(15)

    fig, axes = plt.subplots(1, 2, figsize=(15, 5))
    axes[0].barh(
        [w for w, _ in common][::-1],
        [c for _, c in common][::-1],
        color=COLOR_NEUTRAL,
        edgecolor="black",
    )
    axes[0].set_title("15-ka eray ee ugu badan dataset-ka oo dhan", fontweight="bold")
    axes[0].set_xlabel("Frequency")

    lengths = [len(w) for w in all_words]
    axes[1].hist(lengths, bins=range(1, 16), color=COLOR_ACCENT, edgecolor="black", align="left")
    axes[1].set_title("Dhererka erayada Somali (xarfaha)", fontweight="bold")
    axes[1].set_xlabel("Tirada xarfaha ee erayga")
    axes[1].set_ylabel("Frequency")
    axes[1].axvline(np.mean(lengths), color="red", linestyle="--", label=f"Celcelis = {np.mean(lengths):.1f}")
    axes[1].legend()
    _finish(fig, out, dataset_caption(df, f"Wadar erayo: {len(all_words):,}"))


def plot_wordclouds(df: pd.DataFrame, out: Path):
    """Word clouds tied to each class in YOUR dataset."""
    crime = df[df["category"] == LABEL_CRIME]
    safe = df[df["category"] == LABEL_SAFE]
    panels = [
        (f"Dhammaan ({len(df):,})", " ".join(df["preprocessed_text"]), "Greys"),
        (f"Dambi leh ({len(crime):,})", " ".join(crime["preprocessed_text"]), "Reds"),
        (f"Ma ahan dambi ({len(safe):,})", " ".join(safe["preprocessed_text"]), "Blues"),
    ]
    fig, axes = plt.subplots(1, 3, figsize=(16, 4.8))
    for ax, (title, text, cmap) in zip(axes, panels):
        if text.strip():
            wc = WordCloud(
                width=800,
                height=450,
                background_color="white",
                colormap=cmap,
                max_words=100,
                collocations=False,
            ).generate(text)
            ax.imshow(wc, interpolation="bilinear")
        ax.axis("off")
        ax.set_title(title, fontweight="bold")
    fig.suptitle("Word clouds — erayada muuqda dataset-kaaga", fontsize=14, fontweight="bold", y=1.02)
    _finish(fig, out, dataset_caption(df, "Word clouds"))


def plot_metric_bars(
    df_metrics: pd.DataFrame,
    out: Path,
    title: str,
    caption: str,
    value_cols: list[str] | None = None,
    color_map: dict | None = None,
):
    """Generic clear grouped bar chart for model scores."""
    value_cols = value_cols or [c for c in df_metrics.columns if c != "Model"]
    plot_df = df_metrics.copy()
    fig, ax = plt.subplots(figsize=(12, 5.5))
    x = np.arange(len(plot_df))
    n = len(value_cols)
    w = 0.8 / max(n, 1)
    default_colors = ["#2563eb", "#16a34a", "#9333ea", "#ea580c", "#0891b2"]
    for i, col in enumerate(value_cols):
        color = (color_map or {}).get(col, default_colors[i % len(default_colors)])
        vals = plot_df[col].values
        bars = ax.bar(x + i * w - 0.4 + w / 2, vals, w, label=col, color=color, edgecolor="black")
        for bar, v in zip(bars, vals):
            ax.text(bar.get_x() + bar.get_width() / 2, v + 0.01, f"{v:.2f}", ha="center", va="bottom", fontsize=7)
    ax.set_xticks(x)
    ax.set_xticklabels(plot_df["Model"], rotation=18, ha="right")
    ax.set_ylim(0, 1.12)
    ax.set_ylabel("Score (0–1)")
    ax.set_title(title, fontweight="bold")
    ax.legend(ncol=min(4, n), fontsize=8)
    ax.axhline(0.9, color="#94a3b8", linestyle=":", linewidth=1)
    _finish(fig, out, caption)


def plot_confusion_and_roc(
    y_true,
    y_pred,
    scores,
    model_name: str,
    out: Path,
    caption: str,
):
    """Confusion matrix + ROC for crime detection — labels in plain language."""
    from sklearn.metrics import auc, confusion_matrix, roc_curve

    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    order = [LABEL_SAFE, LABEL_CRIME]
    cm = confusion_matrix(y_true, y_pred, labels=order)
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        ax=axes[0],
        xticklabels=["Pred: Ma ahan dambi", "Pred: Dambi"],
        yticklabels=["Run: Ma ahan dambi", "Run: Dambi"],
    )
    axes[0].set_title(f"Confusion Matrix — {model_name}\n(test set ee dataset-kaaga)", fontweight="bold")
    axes[0].set_xlabel("Waxa model-ku sheegay")
    axes[0].set_ylabel("Xaqiiqda (label)")

    y_bin = (pd.Series(y_true).astype(str) == LABEL_CRIME).astype(int)
    fpr, tpr, _ = roc_curve(y_bin, scores)
    roc_auc = auc(fpr, tpr)
    axes[1].plot(fpr, tpr, color=COLOR_CRIME, lw=2.5, label=f"AUC = {roc_auc:.3f}")
    axes[1].plot([0, 1], [0, 1], "k--", alpha=0.4, label="Random guess")
    axes[1].set_xlabel("False Positive Rate (khalad: dambi sheegay)")
    axes[1].set_ylabel("True Positive Rate (crime recall)")
    axes[1].set_title("ROC — awoodda kala saarida dambi", fontweight="bold")
    axes[1].legend(loc="lower right")
    _finish(fig, out, caption)
