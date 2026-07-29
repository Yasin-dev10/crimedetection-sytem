# Automatic Crime Detection — Pipeline Sharaxaad

Dokumentigan wuxuu sharxayaa **pipeline-ka dhabta ah** ee loo maray `model/Automatic_crime.ipynb` iyo `model/train_pipeline.py`, iyo sida uu ugu xirmo production API-ga (`ai-model/app.py`).

---

## Sawir guud (end-to-end)

```text
CSV Dataset
    │
    ▼
1. Data Cleaning
    │
    ▼
2. Preprocessing (Somali text)     ◄── isla function-ka API-ga isticmaalo
    │
    ▼
3. EDA / Visualizations
    │
    ▼
4. Train / Val / Test Split        ◄── SPLIT KA HOR vectorization (no leakage)
    │
    ▼
5. TF-IDF Feature Engineering      ◄── fit TRAIN only
    │
    ▼
6. Baseline Model Training
    │
    ▼
7. Feature Optimization
    │
    ▼
8. Hyperparameter Tuning (CV)
    │
    ▼
9. Hold-out Model Testing
    │
    ▼
10. Save Production Artifacts
        ├── ai-model/crime_model.pkl
        ├── ai-model/vectorizer.pkl
        └── ai-model/model_meta.pkl
    │
    ▼
11. Flask API Inference            ◄── preprocess → vectorize → predict
```

---

## Tallaabo 1 — Data Loading & Cleaning

**Input:** `model/dataset.csv.csv`

**Waxa la sameeyo:**
- Akhrinta CSV (`utf-8`, haddii ay fashilanto `latin1`)
- Tirtiridda columns-ka `Unnamed:*` (CSV artifacts)
- Drop rows aan lahayn `text` ama `category`
- Normalize labels → kaliya:
  - `crime-related`
  - `not crime-related`
- Tirtir qoraalada aad u gaagaaban (< 40 characters)
- Tirtir duplicates (isku mid ah `text`)

**Natiijo (run-kii ugu dambeeyay):** ~**8,438** documents (ka dib cleaning), ~4711 crime / ~3727 not-crime.

**Maxay tahay sababta?** Data wasakh ah / HTML / rows madhan waxay model-ka qalloocinayaan. Cleaning ayaa accuracy dhab ah kor u qaada.

---

## Tallaabo 2 — Preprocessing (wadaag training + API)

**Fayl:** `ai-model/preprocessing.py`  
**Function:** `preprocess_text()`  
**Stopwords:** `somali_stopwords.json` (~303 — laga soo qaatay **model sax.ipynb**)

**Tallaabooyinka qoraalka (pipeline + model sax):**
1. Lowercase
2. Tirtir HTML tags
3. Tirtir URLs / emails / `@mentions` / `#hashtags` / digits
4. Keep Latin letters + apostrophe (Somali)
5. Remove Somali stopwords (liiska sax)
6. Join tokens → cleaned string

**Muhiim:** Isla preprocessing-kan ayaa Flask API-gu isticmaalaa ka hor `vectorizer.transform()`.

---

## Tallaabo 3 — Visualizations (EDA)

Sawirradu waxay ku kaydsamaan `model/figures/`.  
Qaar ayaa laga soo qaatay **model sax.ipynb**:

| Fayl | Ujeeddo | Source |
|------|---------|--------|
| `00_duplicates.png` | Duplicate vs unique | model sax |
| `00a_dataset_sources.png` | Website-yada laga keenay dataset-ka iyo tirada il kasta | dataset URL |
| `01_category_balance.png` | Saamiga / tirada categories | pipeline |
| `02_text_length_comparison.png` | Length + crime vs not-crime averages | sax + pipeline |
| `03_top_words_by_class.png` | Top words labada class | sax + pipeline |
| `03b_word_freq_and_length.png` | Most common words + word length | model sax |
| `03c_wordclouds.png` | Wordclouds: all / crime / not-crime | model sax |
| `04`–`08_*.png` | Baseline, optimization, tuning, test | pipeline |

---

## Tallaabo 4 — Train / Validation / Test Split

**Qaybinta (stratified):**
- **70% Train** — model-ku halkan ku bartaa
- **15% Validation** — baseline + feature optimization
- **15% Test** — **lama taabto** ilaa evaluation-ka ugu dambeeya

**Qaanuun muhiim ah:** Split-ka wuxuu dhacaa **qoraalka saafi ah** ka hor TF-IDF.  
Haddii TF-IDF lagu fit-gareeyo data-da oo dhan ka hor split → **data leakage** (accuracy been ah).

---

## Tallaabo 5 — Feature Engineering (TF-IDF)

**Habka:**
- `TfidfVectorizer` waxaa lagu **fit** gareeyaa **train only**
- Val / Test waxaa lagu **transform** gareeyaa (vocabulary cusub lama baranayo)

**Default / best config (run ugu dambeeyay):**
- `max_features = 10000`
- `ngram_range = (1, 2)` (unigrams + bigrams)
- `sublinear_tf = True`
- Magaca config: `word_10k_(1,2)`

Natiijadu waa matrix sparse: documents × features.

---

## Tallaabo 6 — Model Training (Baseline)

Models la isbarbardhigay (validation set):

- Logistic Regression
- Naive Bayes
- Decision Tree
- Random Forest
- Gradient Boosting
- Linear SVM
- KNN

**Metrics:** Accuracy, Precision, Recall, F1, iyo **Crime Recall** (muhiim: inaan dil / qarax la seegin).

Sawir: `figures/04_baseline_comparison.png`

---

## Tallaabo 7 — Optimization (Feature configs)

La isku dayay configs kala duwan:

| Config | Macnaha |
|--------|---------|
| `word_3k_(1,1)` | 3k words, unigrams |
| `word_10k_(1,2)` | 10k words, uni+bi |
| `word_15k_(1,3)` | 15k words, uni+bi+tri |
| `char_8k_(3,5)` | char n-grams (Somali morphology) |

Probe classifier: Logistic Regression on validation.  
**Guusha:** `word_10k_(1,2)` ayaa ugu fiicnaa.

Sawir: `figures/05_feature_optimization.png`

---

## Tallaabo 8 — Hyperparameter Tuning

**Habka:** `RandomizedSearchCV` + **3-fold Stratified CV**  
**Data:** Train + Validation (Test weli ma jiro)  
**Scoring:** `f1_weighted`

Models la tune-gareeyay:
- Logistic Regression → `C`, `penalty`, `solver`
- Linear SVM → `C`
- Random Forest → `n_estimators`, `max_depth`, `min_samples_*`, `max_features`
- Naive Bayes → `alpha`, `fit_prior`

Sawir: `figures/06_hyperparameter_tuning.png`

> Hore notebook-kii duugga ahaa **ma lahan** tuning. Tani waa qaybta cusub ee kor u qaadaysa performance.

---

## Tallaabo 9 — Model Testing (Hold-out Test)

Test set-ka oo **aan waligiis** loo isticmaalin training/tuning ayaa la qiimeeyaa.

**Natiijooyinka ugu dambeeyay:**

| Model | Accuracy | F1 | Crime Recall |
|-------|----------|-----|--------------|
| **Random Forest (tuned)** | **92.3%** | **92.3%** | **95.9%** |
| Logistic Regression | 91.5% | 91.5% | 92.8% |
| Linear SVM | 91.3% | 91.3% | 92.6% |

Sidoo kale:
- Confusion matrix
- ROC curve + AUC
- Error analysis (False Negatives / False Positives)

Sawirro: `07_test_confusion_roc.png`, `08_model_testing.png`

**Production choice:** Random Forest (F1 ugu sarreeya + crime recall sarreeya).

---

## Tallaabo 10 — Save Production Artifacts

Waxaa la kaydiyaa:

| Fayl | Waxa ku jira |
|------|----------------|
| `ai-model/crime_model.pkl` | Classifier-ka ugu fiican (RF) |
| `ai-model/vectorizer.pkl` | TF-IDF vectorizer (fitted) |
| `ai-model/model_meta.pkl` | Magaca model, config, metrics |

Magacyadan waa kuwa Flask-ku akhriyo — **ma aha** `model.pkl` (taasi waa khalad hore).

---

## Tallaabo 11 — Production Inference (API)

**Fayl:** `ai-model/app.py`  
**Endpoint:** `POST /predict`

```text
Raw text (user / scraper)
        │
        ▼
preprocess_text()          # isla training
        │
        ▼
vectorizer.transform()
        │
        ▼
model.predict() + predict_proba()
        │
        ▼
Keyword fallback (dil, qarax, afduub, ...)  # haddii model seego
        │
        ▼
JSON: prediction, confidence, location, matchedKeyword
```

Tusaale:
- “Nin ayaa lagu dilay…” → `crime-related` (model)
- “Ciyaaraha football…” → `not crime-related` (model)
- “Qarax ayaa ka dhacay…” → `crime-related` (keyword fallback haddii model gaagaaban yahay)

---

## Sida loo ordo pipeline-ka

**Option A — Jupyter**
1. Fur `model/Automatic_crime.ipynb`
2. Orso cells-ka si isku xiga (Setup → … → Save)
3. Restart AI API (port 5001)

**Option B — Script**
```powershell
ai-model\.venv\Scripts\python.exe model\train_pipeline.py
```

---

## Qodobada muhiimka ah ee xasuusto

1. **No leakage:** split → fit vectorizer train only  
2. **Train/serve parity:** isla `preprocessing.py`  
3. **Crime Recall** waa KPI muhiim (amniga)  
4. **Tuning** wuxuu kordhiyaa F1 dhab ah  
5. **Save path sax:** `crime_model.pkl` + `vectorizer.pkl`  
6. Keyword fallback waa badbaado — laakiin model-ka waa inuu ahaado aasaaska

---

*Updated after full pipeline run · production model: Random Forest · feature config: word_10k_(1,2)*
