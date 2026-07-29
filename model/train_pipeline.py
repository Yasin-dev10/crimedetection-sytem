"""Run the Automatic_crime training pipeline headlessly and save production artifacts."""
from __future__ import annotations

import sys
import warnings
from collections import Counter
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from scipy.sparse import vstack
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    auc,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_curve,
)
from sklearn.model_selection import RandomizedSearchCV, StratifiedKFold, train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.svm import LinearSVC
from sklearn.tree import DecisionTreeClassifier
from wordcloud import WordCloud

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent
AI_MODEL_DIR = ROOT.parent / "ai-model"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(AI_MODEL_DIR))
import chart_style as charts
from preprocessing import clean_text, load_somali_stopwords, preprocess_text

sns.set_theme(style="whitegrid", context="notebook")
RANDOM_STATE = 42
CRIME_LABEL = "crime-related"
NON_CRIME_LABEL = "not crime-related"
OUTPUT_DIR = ROOT / "figures"
OUTPUT_DIR.mkdir(exist_ok=True)


def evaluate_model(model, X_eval, y_eval):
    pred = model.predict(X_eval)
    return {
        "accuracy": accuracy_score(y_eval, pred),
        "precision": precision_score(y_eval, pred, average="weighted", zero_division=0),
        "recall": recall_score(y_eval, pred, average="weighted", zero_division=0),
        "f1": f1_score(y_eval, pred, average="weighted", zero_division=0),
        "crime_recall": recall_score(y_eval, pred, pos_label=CRIME_LABEL, zero_division=0),
        "predictions": pred,
    }


def make_vectorizer(max_features=10000, ngram_range=(1, 2), analyzer="word"):
    return TfidfVectorizer(
        max_features=max_features,
        min_df=2,
        max_df=0.92,
        ngram_range=ngram_range,
        analyzer=analyzer,
        sublinear_tf=True,
    )


def main():
    print("Stopwords:", len(load_somali_stopwords()))
    dataset_path = ROOT / "dataset.csv.csv"
    try:
        df = pd.read_csv(dataset_path, encoding="utf-8")
    except UnicodeDecodeError:
        df = pd.read_csv(dataset_path, encoding="latin1")

    df.columns = df.columns.str.strip()
    df = df.loc[:, ~df.columns.str.startswith("Unnamed")]
    df = df.dropna(subset=["text", "category"]).copy()
    df["text"] = df["text"].astype(str)
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
    df["text"] = df["text"].str.strip()

    # Clear dataset-linked EDA charts
    charts.plot_dataset_sources(df, OUTPUT_DIR / "00a_dataset_sources.png")
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
    df["text_length"] = df["text"].str.len()
    df["sentence_length"] = df["cleaned_text"].str.len()
    df["word_count"] = df["preprocessed_text"].str.split().str.len()
    print("Documents after cleaning:", len(df), "| removed dupes:", n_dupes)
    print(df["category"].value_counts().to_dict())

    charts.plot_category_balance(df, OUTPUT_DIR / "01_category_balance.png")
    charts.plot_text_length(df, OUTPUT_DIR / "02_text_length_comparison.png")
    charts.plot_top_words_by_class(df, OUTPUT_DIR / "03_top_words_by_class.png")
    charts.plot_word_freq_and_length(df, OUTPUT_DIR / "03b_word_freq_and_length.png")
    charts.plot_wordclouds(df, OUTPUT_DIR / "03c_wordclouds.png")

    X_text = df["preprocessed_text"]
    y = df["category"]
    X_train_text, X_temp_text, y_train, y_temp = train_test_split(
        X_text, y, test_size=0.30, random_state=RANDOM_STATE, stratify=y
    )
    X_val_text, X_test_text, y_val, y_test = train_test_split(
        X_temp_text, y_temp, test_size=0.50, random_state=RANDOM_STATE, stratify=y_temp
    )
    print("Split:", len(X_train_text), len(X_val_text), len(X_test_text))

    vectorizer = make_vectorizer(10000, (1, 2), "word")
    X_train = vectorizer.fit_transform(X_train_text)
    X_val = vectorizer.transform(X_val_text)
    X_test = vectorizer.transform(X_test_text)

    baseline_models = {
        "Logistic Regression": LogisticRegression(
            max_iter=2000, class_weight="balanced", random_state=RANDOM_STATE
        ),
        "Naive Bayes": MultinomialNB(alpha=0.5),
        "Decision Tree": DecisionTreeClassifier(
            max_depth=20, random_state=RANDOM_STATE, class_weight="balanced"
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=200,
            max_depth=25,
            random_state=RANDOM_STATE,
            class_weight="balanced_subsample",
            n_jobs=-1,
        ),
        "Gradient Boosting": GradientBoostingClassifier(
            n_estimators=120, random_state=RANDOM_STATE
        ),
        "Linear SVM": LinearSVC(
            max_iter=3000, class_weight="balanced", dual=False, random_state=RANDOM_STATE
        ),
        "KNN": KNeighborsClassifier(n_neighbors=7),
    }

    trained = {}
    baseline_rows = []
    print("\nBaseline training...")
    for name, model in baseline_models.items():
        model.fit(X_train, y_train)
        trained[name] = model
        metrics = evaluate_model(model, X_val, y_val)
        baseline_rows.append(
            {
                "Model": name,
                "Accuracy": metrics["accuracy"],
                "F1": metrics["f1"],
                "Crime Recall": metrics["crime_recall"],
            }
        )
        print(f"  {name:22s} F1={metrics['f1']:.4f} CrimeRecall={metrics['crime_recall']:.4f}")

    baseline_df = pd.DataFrame(baseline_rows).sort_values("F1", ascending=False).reset_index(drop=True)

    plot_df = baseline_df.sort_values("F1")
    fig, ax = plt.subplots(figsize=(12, 6))
    y_pos = np.arange(len(plot_df))
    ax.barh(y_pos, plot_df["F1"], color="#27ae60", edgecolor="black", height=0.45, label="F1")
    ax.barh(
        y_pos + 0.45,
        plot_df["Crime Recall"],
        color="#e67e22",
        edgecolor="black",
        height=0.45,
        label="Crime Recall",
    )
    ax.set_yticks(y_pos + 0.225)
    ax.set_yticklabels(plot_df["Model"])
    ax.set_xlim(0, 1.05)
    ax.set_xlabel("Score (0–1)")
    ax.set_title("Baseline Models — Validation F1 vs Crime Recall")
    ax.legend(loc="lower right")
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "04_baseline_comparison.png", dpi=200, bbox_inches="tight")
    plt.close()

    feature_configs = [
        {"name": "word_3k_(1,1)", "max_features": 3000, "ngram_range": (1, 1), "analyzer": "word"},
        {"name": "word_5k_(1,1)", "max_features": 5000, "ngram_range": (1, 1), "analyzer": "word"},
        {"name": "word_10k_(1,2)", "max_features": 10000, "ngram_range": (1, 2), "analyzer": "word"},
        {"name": "word_15k_(1,3)", "max_features": 15000, "ngram_range": (1, 3), "analyzer": "word"},
        {"name": "char_8k_(3,5)", "max_features": 8000, "ngram_range": (3, 5), "analyzer": "char_wb"},
    ]
    opt_rows = []
    print("\nFeature optimization...")
    for cfg in feature_configs:
        vec = make_vectorizer(cfg["max_features"], cfg["ngram_range"], cfg["analyzer"])
        Xt = vec.fit_transform(X_train_text)
        Xv = vec.transform(X_val_text)
        clf = LogisticRegression(max_iter=2000, class_weight="balanced", random_state=RANDOM_STATE)
        clf.fit(Xt, y_train)
        m = evaluate_model(clf, Xv, y_val)
        opt_rows.append(
            {
                "Config": cfg["name"],
                "Features": Xt.shape[1],
                "F1": m["f1"],
                "Crime Recall": m["crime_recall"],
                "Accuracy": m["accuracy"],
            }
        )
        print(f"  {cfg['name']:18s} F1={m['f1']:.4f}")

    opt_df = pd.DataFrame(opt_rows).sort_values("F1", ascending=False).reset_index(drop=True)
    best_feature_name = opt_df.iloc[0]["Config"]
    print("Best feature config:", best_feature_name)

    fig, ax = plt.subplots(figsize=(11, 5))
    x = np.arange(len(opt_df))
    width = 0.35
    ax.bar(x - width / 2, opt_df["F1"], width, label="F1", color="#27ae60", edgecolor="black")
    ax.bar(
        x + width / 2,
        opt_df["Crime Recall"],
        width,
        label="Crime Recall",
        color="#e67e22",
        edgecolor="black",
    )
    ax.set_xticks(x)
    ax.set_xticklabels(opt_df["Config"], rotation=15, ha="right")
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("Score")
    ax.set_title("Optimization: TF-IDF Feature Configs (validation)")
    ax.legend()
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "05_feature_optimization.png", dpi=200, bbox_inches="tight")
    plt.close()

    best_cfg = next(c for c in feature_configs if c["name"] == best_feature_name)
    vectorizer = make_vectorizer(best_cfg["max_features"], best_cfg["ngram_range"], best_cfg["analyzer"])
    X_train = vectorizer.fit_transform(X_train_text)
    X_val = vectorizer.transform(X_val_text)
    X_test = vectorizer.transform(X_test_text)

    cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=RANDOM_STATE)
    X_tune = vstack([X_train, X_val])
    y_tune = pd.concat([y_train, y_val], ignore_index=True)

    tuning_spaces = {
        "Logistic Regression": (
            LogisticRegression(max_iter=2500, class_weight="balanced", random_state=RANDOM_STATE),
            [
                {
                    "C": np.logspace(-2, 2, 10),
                    "penalty": ["l2"],
                    "solver": ["lbfgs", "liblinear", "saga"],
                },
                {"C": np.logspace(-2, 2, 10), "penalty": ["l1"], "solver": ["liblinear", "saga"]},
            ],
        ),
        "Linear SVM": (
            LinearSVC(max_iter=4000, class_weight="balanced", dual=False, random_state=RANDOM_STATE),
            {"C": np.logspace(-2, 2, 12)},
        ),
        "Random Forest": (
            RandomForestClassifier(
                class_weight="balanced_subsample", random_state=RANDOM_STATE, n_jobs=-1
            ),
            {
                "n_estimators": [120, 200, 300],
                "max_depth": [15, 25, 40, None],
                "min_samples_split": [2, 5, 10],
                "min_samples_leaf": [1, 2, 4],
                "max_features": ["sqrt", 0.3],
            },
        ),
        "Naive Bayes": (
            MultinomialNB(),
            {"alpha": [0.01, 0.1, 0.5, 1.0, 2.0], "fit_prior": [True, False]},
        ),
    }

    tuned_models = {}
    tune_rows = []
    print("\nHyperparameter tuning...")
    for name, (estimator, params) in tuning_spaces.items():
        search = RandomizedSearchCV(
            estimator,
            param_distributions=params,
            n_iter=10,
            scoring="f1_weighted",
            cv=cv,
            random_state=RANDOM_STATE,
            n_jobs=-1,
            verbose=0,
            refit=True,
        )
        search.fit(X_tune, y_tune)
        tuned_models[name] = search.best_estimator_
        tune_rows.append({"Model": name, "Best CV F1": search.best_score_, "Best Params": search.best_params_})
        print(f"  {name:22s} CV F1={search.best_score_:.4f} params={search.best_params_}")

    tune_df = pd.DataFrame(
        [{"Model": r["Model"], "Best CV F1": r["Best CV F1"]} for r in tune_rows]
    ).sort_values("Best CV F1", ascending=False)

    fig, ax = plt.subplots(figsize=(10, 5))
    plot_t = tune_df.sort_values("Best CV F1")
    ax.barh(plot_t["Model"], plot_t["Best CV F1"], color="#8e44ad", edgecolor="black")
    ax.set_xlim(0, 1.05)
    ax.set_xlabel("Cross-validated F1 (weighted)")
    ax.set_title("Hyperparameter Tuning Results (3-fold CV)")
    for i, v in enumerate(plot_t["Best CV F1"]):
        ax.text(v + 0.01, i, f"{v:.3f}", va="center")
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "06_hyperparameter_tuning.png", dpi=200, bbox_inches="tight")
    plt.close()

    test_rows = []
    test_preds = {}
    for name, model in tuned_models.items():
        m = evaluate_model(model, X_test, y_test)
        test_preds[name] = m["predictions"]
        test_rows.append(
            {
                "Model": name,
                "Accuracy": m["accuracy"],
                "F1": m["f1"],
                "Crime Precision": precision_score(
                    y_test, m["predictions"], pos_label=CRIME_LABEL, zero_division=0
                ),
                "Crime Recall": m["crime_recall"],
            }
        )

    best_baseline_name = baseline_df.iloc[0]["Model"]
    m_base = evaluate_model(trained[best_baseline_name], X_test, y_test)
    test_rows.append(
        {
            "Model": f"{best_baseline_name} (baseline)",
            "Accuracy": m_base["accuracy"],
            "F1": m_base["f1"],
            "Crime Precision": precision_score(
                y_test, m_base["predictions"], pos_label=CRIME_LABEL, zero_division=0
            ),
            "Crime Recall": m_base["crime_recall"],
        }
    )
    test_df = pd.DataFrame(test_rows).sort_values("F1", ascending=False).reset_index(drop=True)
    print("\n=== HOLD-OUT TEST ===")
    print(test_df.to_string(index=False))

    production_name = max(
        tuned_models.keys(),
        key=lambda n: f1_score(y_test, test_preds[n], average="weighted"),
    )
    production_model = tuned_models[production_name]
    print("Selected:", production_name)

    y_pred = production_model.predict(X_test)
    labels_order = [NON_CRIME_LABEL, CRIME_LABEL]
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    cm = confusion_matrix(y_test, y_pred, labels=labels_order)
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        ax=axes[0],
        xticklabels=["Pred: NOT crime", "Pred: CRIME"],
        yticklabels=["True: NOT crime", "True: CRIME"],
    )
    axes[0].set_title(f"Confusion Matrix — {production_name}")
    y_bin = (y_test == CRIME_LABEL).astype(int)
    if hasattr(production_model, "predict_proba"):
        scores = production_model.predict_proba(X_test)[
            :, list(production_model.classes_).index(CRIME_LABEL)
        ]
    elif hasattr(production_model, "decision_function"):
        scores = production_model.decision_function(X_test)
    else:
        scores = (y_pred == CRIME_LABEL).astype(float)
    fpr, tpr, _ = roc_curve(y_bin, scores)
    roc_auc = auc(fpr, tpr)
    axes[1].plot(fpr, tpr, color="#c0392b", lw=2, label=f"AUC = {roc_auc:.3f}")
    axes[1].plot([0, 1], [0, 1], "k--", alpha=0.4)
    axes[1].set_xlabel("False Positive Rate")
    axes[1].set_ylabel("True Positive Rate")
    axes[1].set_title("ROC Curve (crime-related)")
    axes[1].legend(loc="lower right")
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "07_test_confusion_roc.png", dpi=200, bbox_inches="tight")
    plt.close()
    print(classification_report(y_test, y_pred, digits=4))

    fig, ax = plt.subplots(figsize=(11, 5))
    plot_t = test_df.copy()
    x = np.arange(len(plot_t))
    w = 0.2
    ax.bar(x - 1.5 * w, plot_t["Accuracy"], w, label="Accuracy", color="#3498db", edgecolor="black")
    ax.bar(x - 0.5 * w, plot_t["F1"], w, label="F1", color="#27ae60", edgecolor="black")
    ax.bar(
        x + 0.5 * w,
        plot_t["Crime Precision"],
        w,
        label="Crime Precision",
        color="#9b59b6",
        edgecolor="black",
    )
    ax.bar(
        x + 1.5 * w,
        plot_t["Crime Recall"],
        w,
        label="Crime Recall",
        color="#e67e22",
        edgecolor="black",
    )
    ax.set_xticks(x)
    ax.set_xticklabels(plot_t["Model"], rotation=20, ha="right")
    ax.set_ylim(0, 1.1)
    ax.set_ylabel("Score")
    ax.set_title("Model Testing — Hold-out Test Metrics")
    ax.legend(ncol=2, fontsize=9)
    plt.tight_layout()
    plt.savefig(OUTPUT_DIR / "08_model_testing.png", dpi=200, bbox_inches="tight")
    plt.close()

    if not hasattr(production_model, "predict_proba"):
        print("Calibrating model for predict_proba...")
        calibrator = CalibratedClassifierCV(production_model, method="sigmoid", cv=3)
        calibrator.fit(X_tune, y_tune)
        production_model = calibrator

    model_path = AI_MODEL_DIR / "crime_model.pkl"
    vectorizer_path = AI_MODEL_DIR / "vectorizer.pkl"
    joblib.dump(production_model, model_path)
    joblib.dump(vectorizer, vectorizer_path)
    meta = {
        "model_name": production_name,
        "feature_config": best_feature_name,
        "n_features": int(X_train.shape[1]),
        "train_size": int(X_train.shape[0]),
        "test_f1": float(f1_score(y_test, production_model.predict(X_test), average="weighted")),
        "test_crime_recall": float(
            recall_score(y_test, production_model.predict(X_test), pos_label=CRIME_LABEL)
        ),
        "preprocess": "ai-model/preprocessing.py::preprocess_text",
    }
    joblib.dump(meta, AI_MODEL_DIR / "model_meta.pkl")
    print("Saved:", model_path)
    print("Saved:", vectorizer_path)
    print("Meta:", meta)

    samples = [
        "Nin ayaa lagu dilay magaalada Muqdisho ee degmada Hodan habeen hore.",
        "Ciyaaraha football-ka ayaa caawa ka dhacaya garoonka Muqdisho Stadium.",
        "Qarax ayaa ka dhacay suuqa, dad badan ayaa ku dhaawacmay.",
    ]
    print("\nSmoke test:")
    for s in samples:
        processed = preprocess_text(s)
        vec = vectorizer.transform([processed])
        pred = production_model.predict(vec)[0]
        conf = max(production_model.predict_proba(vec)[0]) * 100
        print(f"  [{pred}] ({conf:.1f}%) :: {s[:70]}")


if __name__ == "__main__":
    main()
