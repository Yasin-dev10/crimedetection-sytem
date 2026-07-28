"""Regenerate clear dataset-linked EDA charts only (no full training)."""
from __future__ import annotations

import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import pandas as pd

ROOT = Path(__file__).resolve().parent
AI_MODEL_DIR = ROOT.parent / "ai-model"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(AI_MODEL_DIR))

import chart_style as charts
from preprocessing import clean_text, load_somali_stopwords, preprocess_text

CRIME_LABEL = "crime-related"
NON_CRIME_LABEL = "not crime-related"
OUTPUT_DIR = ROOT / "figures"
OUTPUT_DIR.mkdir(exist_ok=True)


def main():
    print("Stopwords:", len(load_somali_stopwords()))
    path = ROOT / "dataset.csv.csv"
    try:
        df = pd.read_csv(path, encoding="utf-8")
    except UnicodeDecodeError:
        df = pd.read_csv(path, encoding="latin1")

    df.columns = df.columns.str.strip()
    df = df.loc[:, ~df.columns.str.startswith("Unnamed")]
    df = df.dropna(subset=["text", "category"]).copy()
    df["text"] = df["text"].astype(str).str.strip()
    df["category"] = df["category"].astype(str).str.strip().str.lower()
    df["category"] = df["category"].replace(
        {
            "crime": CRIME_LABEL,
            "crime related": CRIME_LABEL,
            "not crime": NON_CRIME_LABEL,
            "not crime related": NON_CRIME_LABEL,
        }
    )
    df = df[df["category"].isin([CRIME_LABEL, NON_CRIME_LABEL])].copy()

    n_before = len(df)
    n_dupes = int(df.duplicated(subset=["text"]).sum())
    charts.plot_duplicates(
        n_dupes,
        n_before - n_dupes,
        OUTPUT_DIR / "00_duplicates.png",
        caption=f"Dataset: dataset.csv.csv | Kahor cleaning: {n_before:,} rows",
    )

    df = df.drop_duplicates(subset=["text"]).reset_index(drop=True)
    df = df[df["text"].str.len() >= 40].copy()
    df["cleaned_text"] = df["text"].apply(clean_text)
    df["preprocessed_text"] = df["text"].apply(preprocess_text)
    df = df[df["preprocessed_text"].str.len() >= 20].reset_index(drop=True)
    df["word_count"] = df["preprocessed_text"].str.split().str.len()
    df["sentence_length"] = df["cleaned_text"].str.len()

    print("Clean rows:", len(df))
    print(df["category"].value_counts().to_dict())

    charts.plot_category_balance(df, OUTPUT_DIR / "01_category_balance.png")
    charts.plot_text_length(df, OUTPUT_DIR / "02_text_length_comparison.png")
    charts.plot_top_words_by_class(df, OUTPUT_DIR / "03_top_words_by_class.png")
    charts.plot_word_freq_and_length(df, OUTPUT_DIR / "03b_word_freq_and_length.png")
    charts.plot_wordclouds(df, OUTPUT_DIR / "03c_wordclouds.png")
    print("Done. Open model/figures/")


if __name__ == "__main__":
    main()
