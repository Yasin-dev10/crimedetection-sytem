"""Extra justified paragraphs to expand the thesis beyond 100 pages."""

def _p(*parts):
    return " ".join(parts)


EXPANSIONS = {
    "ch1_end": [
        _p(
            "Social media has become one of the fastest channels through which crime-related",
            "narratives circulate in Somalia and the wider Horn of Africa. Posts describing",
            "violence, theft, explosions, or threats can reach thousands of readers within",
            "minutes. At the same time, many posts are ordinary news, entertainment, or civic",
            "discussion and are therefore non-crime-related. An automated system must separate",
            "these two classes reliably so that investigators do not waste time on irrelevant",
            "content while still capturing genuine risk signals.",
        ),
        _p(
            "The decision to focus on binary classification—crime-related versus",
            "non-crime-related—was deliberate. Multi-class crime typing is valuable, but binary",
            "triage is the first operational bottleneck in many agencies. Once a post is flagged",
            "as crime-related, human experts can refine category, location, and urgency. BAREAI",
            "therefore concentrates on high-quality binary decisions delivered through practical",
            "web features: Text Analysis, File Analysis, URL Analysis, and Batch Analysis.",
        ),
        _p(
            "From a research perspective, the study contributes both an empirical comparison of",
            "classical NLP classifiers on Somali-oriented text and a full-stack prototype that",
            "embeds the best model into investigator workflows. The remaining chapters develop",
            "the literature foundation, methodology, implementation evidence, and conclusions",
            "required by the Faculty of Computer and Information Technology FYP guideline.",
        ),
        _p(
            "The background of the study also recognises that digital reporting channels are",
            "unevenly moderated. Anonymous accounts, code-mixed language, and rapidly edited",
            "posts complicate manual review. NLP methods can normalise and score text at a",
            "speed humans cannot match, provided that labelled examples and careful evaluation",
            "are available. This thesis therefore treats data quality and evaluation metrics as",
            "first-class methodological concerns rather than afterthoughts.",
        ),
        _p(
            "Finally, the organisation of chapters follows a consistent academic pattern:",
            "introduction and problem framing; literature and related work; methodology and",
            "design; implementation and results; and discussion with conclusions and",
            "recommendations. Each chapter begins with an introduction that states its purpose",
            "and ends by preparing the reader for the next stage of the argument.",
        ),
    ],
    "ch2_extra": [
        _p(
            "Recent surveys of text classification emphasise that feature representation and",
            "model choice jointly determine performance, especially for low-resource languages.",
            "TF-IDF remains competitive when labelled data are limited and compute budgets are",
            "constrained, while transformer models become attractive when large corpora and GPUs",
            "are available. For this FYP, classical models were prioritised because they are",
            "transparent, fast to train, and easy to deploy with Joblib artefacts on student hardware.",
        ),
        _p(
            "Crime detection from social media also raises ethical and operational issues: false",
            "positives may stigmatise authors, while false negatives may delay response.",
            "Balanced precision and recall are therefore essential. Literature on cybercrime",
            "complaint triage similarly stresses scalable, language-aware pipelines. BAREAI",
            "aligns with that agenda by combining automated scoring with human case claiming",
            "rather than fully autonomous policing decisions.",
        ),
        _p(
            "Gaps identified across related work include insufficient Somali-language resources,",
            "limited end-to-end systems that connect classification to investigation case",
            "management, and weak support for multi-source inputs such as files and URLs. The",
            "proposed system addresses these gaps within the scope of an undergraduate project",
            "by delivering a working NLP classifier and a role-based web application.",
        ),
        _p(
            "Traditional classification techniques such as keyword lists and manual coding",
            "remain useful as baselines and as safety nets. In BAREAI, Somali crime keywords",
            "complement the Random Forest decision when explicit high-risk terms appear. This",
            "hybrid design reflects literature recommendations to combine statistical learning",
            "with domain rules in security-sensitive applications.",
        ),
        _p(
            "Cybercrime research further shows that attackers adapt language to evade filters.",
            "Therefore, continuous retraining and monitoring are recommended in long-term",
            "deployments. Although continuous learning is outside the current FYP scope, the",
            "system architecture already isolates the model service so that updated pickle",
            "files can be swapped without rewriting the web interface.",
        ),
        _p(
            "In summary, the literature supports an NLP approach to social media crime-text",
            "triage, highlights evaluation with Accuracy, Precision, Recall, and F1-score, and",
            "encourages deployable prototypes. Chapter Three translates these lessons into a",
            "concrete methodology for BAREAI.",
        ),
    ],
    "ch3_extra": [
        _p(
            "Methodologically, reproducibility was maintained by fixing random seeds, documenting",
            "preprocessing steps, and serialising both the vectorizer and the classifier. This",
            "ensures that the same pipeline used in training can be reconstructed at inference",
            "time inside the Flask service. Hyperparameter choices for Random Forest favoured",
            "stable generalisation over aggressive depth that could overfit sparse TF-IDF space.",
        ),
        _p(
            "The feasibility study confirmed that open-source tools were sufficient for the",
            "project timeframe. Economic feasibility is supported by the absence of paid NLP",
            "APIs for core classification. Operational feasibility is supported by interfaces",
            "that mirror investigator tasks: analyse, claim, update, and report. Schedule",
            "feasibility followed the standard FYP calendar from literature review through",
            "demonstration and thesis writing.",
        ),
        _p(
            "System design artefacts—including use cases and database collections—were kept",
            "aligned with implemented code. Where UML-level detail is required for examination,",
            "figures in this chapter and the appendices provide the necessary references. The",
            "architecture pipeline diagram deliberately starts from social media data and ends",
            "at the web application to satisfy the requirement that design show the full flow,",
            "not only model inference.",
        ),
        _p(
            "Data acquisition emphasised near-balanced classes so that accuracy would not be",
            "inflated by a majority non-crime class. Stratified splitting preserved that balance",
            "in training and testing. Preprocessing removed URLs and emails, retained scripts",
            "relevant to Somali orthography, and removed stopwords to focus the vectorizer on",
            "content-bearing tokens.",
        ),
        _p(
            "Feature engineering experiments compared Bag-of-Words and TF-IDF settings. TF-IDF",
            "was retained because it down-weights overly common tokens and improves separation",
            "in sparse spaces. The deployed vectorizer uses a larger vocabulary than early",
            "notebook experiments to improve coverage during live inference on unseen posts.",
        ),
        _p(
            "Model development compared Logistic Regression, SVM, Random Forest, and additional",
            "baselines. Random Forest delivered the strongest overall metrics and was selected.",
            "Deployment through Flask keeps inference language-aligned with training (Python",
            "and scikit-learn) while the Express backend orchestrates authentication and",
            "persistence for the React clients.",
        ),
    ],
    "ch4_extra": [
        _p(
            "Implementation testing covered API responses, model health checks, and end-to-end",
            "user journeys for Text, File, URL, and Batch analysis. In each journey, the",
            "expected outputs were a binary class label and a confidence value. When",
            "crime-related content was detected, the system created investigation cases and",
            "emitted notifications, confirming integration between the NLP service and business logic.",
        ),
        _p(
            "Website screenshots document the visual state of the prototype at demonstration",
            "time. They show that public users can analyse posts without administrative",
            "privileges, while investigators and admins access operational modules. This",
            "separation of concerns is essential for security and usability in a multi-role environment.",
        ),
        _p(
            "Comparative tables confirm that Random Forest was the strongest model among those",
            "evaluated, including Logistic Regression and SVM. Accuracy near 89.55% is treated",
            "as the primary reported headline metric because it matched precision, recall, and",
            "F1 on the balanced test partition. Future work may push beyond this ceiling with",
            "larger datasets or contextual embeddings, but the deployed system already meets",
            "the FYP objective of automating crime versus non-crime triage.",
        ),
        _p(
            "Additional functional tests verified guest rate limits, JWT-protected routes, and",
            "blacklist matching. These tests ensure that classification is not the only quality",
            "gate; operational controls also protect the platform from abuse and help investigators",
            "focus on monitored sources.",
        ),
        _p(
            "Performance observations during local demonstration indicated that inference",
            "responses typically returned within a few seconds for short to medium posts,",
            "which is acceptable for interactive triage. Batch jobs naturally take longer in",
            "proportion to the number of items submitted, which users can anticipate from the",
            "interface design.",
        ),
        _p(
            "Overall, Chapter Four provides empirical and visual evidence that BAREAI was",
            "implemented as specified: social media text is collected through multiple channels,",
            "classified into crime-related or non-crime-related outputs, and managed through",
            "dashboard, case, and monitoring screens.",
        ),
    ],
    "ch5_extra": [
        _p(
            "Interpreting the results against the research questions shows that automated",
            "classification reduces manual sorting load, that Somali-oriented text can be",
            "collected and preprocessed effectively, that TF-IDF features support accurate",
            "discrimination, and that a complete NLP-enabled website can be delivered within",
            "undergraduate constraints. The contribution is therefore both scientific and practical.",
        ),
        _p(
            "Limitations remain. Binary labels do not capture fine-grained crime types; social",
            "media scraping is fragile; and transformer models were not fully operationalised.",
            "These limitations define a clear roadmap: expand labelled data, add multi-class",
            "heads, improve explainability for investigators, and harden monitoring against",
            "platform changes.",
        ),
        _p(
            "In conclusion, BAREAI demonstrates that Artificial Intelligence and NLP can",
            "classify social media posts as crime-related or non-crime-related and present",
            "those decisions through Text, File, URL, and Batch analysis interfaces. The",
            "prototype is recommended as a foundation for further institutional pilot testing",
            "under appropriate legal and ethical oversight.",
        ),
        _p(
            "Recommendations for practitioners include starting with monitored high-risk",
            "sources, reviewing low-confidence predictions manually, and maintaining an audit",
            "trail of classification decisions. Recommendations for researchers include",
            "releasing carefully anonymised Somali crime-text benchmarks and evaluating",
            "calibrated probabilities for investigator-facing confidence displays.",
        ),
        _p(
            "The final take-home message is that effective crime-text triage in low-resource",
            "settings is achievable with disciplined data work, transparent classical models,",
            "and a thoughtfully designed web application. BAREAI embodies that combination",
            "for Jamhuriya University’s Computer Applications programme.",
        ),
    ],
}


def inject(doc, key, add_body_fn):
    for para in EXPANSIONS.get(key, []):
        add_body_fn(doc, para)
    try:
        from thesis_expansions_extra import EXTRA

        for para in EXTRA.get(key, []):
            add_body_fn(doc, para)
    except Exception:
        pass
