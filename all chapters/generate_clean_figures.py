"""Regenerate clean, non-overlapping thesis figures."""

import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Circle, Ellipse, FancyBboxPatch, Rectangle

OUT = "thesis_figures"
os.makedirs(OUT, exist_ok=True)


def save(fig, name):
    fig.savefig(
        os.path.join(OUT, name),
        dpi=220,
        bbox_inches="tight",
        facecolor="white",
        pad_inches=0.4,
    )
    plt.close(fig)
    print("saved", name)


def fig_architecture():
    fig, ax = plt.subplots(figsize=(10, 8.5))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 8.5)
    ax.axis("off")
    ax.set_title("BAREAI Three-Tier System Architecture", fontsize=14, fontweight="bold", pad=18)

    layers = [
        (6.7, "#1F4E79", "#D6EAF8", "Presentation Layer", "React + Vite + Tailwind CSS", "Admin | Investigator | Public User"),
        (4.8, "#117A65", "#D5F5E3", "Application Layer", "Node.js Express REST API (port 5000)", "Auth, Analysis, Cases, Blacklist, Monitors"),
        (2.9, "#922B21", "#FADBD8", "Intelligence Layer", "Flask NLP Service (port 5001)", "Random Forest + TF-IDF (.pkl)"),
        (1.0, "#5B2C6F", "#F5EEF8", "Data Layer", "MongoDB database", "Users, History, Cases, Blacklist, Logs"),
    ]
    for y, ec, fc, title, line1, line2 in layers:
        ax.add_patch(
            FancyBboxPatch(
                (0.8, y),
                8.4,
                1.55,
                boxstyle="round,pad=0.02,rounding_size=0.12",
                linewidth=1.8,
                edgecolor=ec,
                facecolor=fc,
            )
        )
        ax.text(5, y + 1.15, title, ha="center", va="center", fontsize=12, fontweight="bold", color=ec)
        ax.text(5, y + 0.65, line1, ha="center", va="center", fontsize=10)
        ax.text(5, y + 0.28, line2, ha="center", va="center", fontsize=9, color="#34495E")

    for y_from, y_to in [(6.7, 6.35), (4.8, 4.45), (2.9, 2.55)]:
        ax.annotate(
            "",
            xy=(5, y_to),
            xytext=(5, y_from),
            arrowprops=dict(arrowstyle="->", color="#2C3E50", lw=1.6),
        )
    save(fig, "fig3_1_architecture.png")


def fig_pipeline():
    fig, ax = plt.subplots(figsize=(12, 3.4))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 3.4)
    ax.axis("off")
    ax.set_title("NLP Crime Classification Pipeline", fontsize=13, fontweight="bold", pad=12)
    labels = ["Raw Text", "Clean &\nStopwords", "TF-IDF", "Train\nModels", "Evaluate", "Deploy\nAPI"]
    xs = [0.35, 2.3, 4.25, 6.2, 8.15, 10.1]
    for i, (x, lab) in enumerate(zip(xs, labels)):
        ax.add_patch(
            FancyBboxPatch(
                (x, 0.9),
                1.6,
                1.4,
                boxstyle="round,pad=0.02,rounding_size=0.1",
                linewidth=1.4,
                edgecolor="#1A5276",
                facecolor="#D4E6F1",
            )
        )
        ax.text(x + 0.8, 1.6, lab, ha="center", va="center", fontsize=9, fontweight="bold")
        if i < len(xs) - 1:
            ax.annotate(
                "",
                xy=(xs[i + 1], 1.6),
                xytext=(x + 1.6, 1.6),
                arrowprops=dict(arrowstyle="->", color="#1A5276", lw=1.5),
            )
    save(fig, "fig3_2_pipeline.png")


def fig_preprocessing():
    fig, ax = plt.subplots(figsize=(7, 10))
    ax.set_xlim(0, 7)
    ax.set_ylim(0, 10)
    ax.axis("off")
    ax.set_title("Text Preprocessing Flowchart", fontsize=13, fontweight="bold", pad=14)
    steps = [
        "1. Load Dataset (CSV)",
        "2. Drop missing text/category",
        "3. Lowercase + remove URL/email",
        "4. Keep Latin and Arabic chars",
        "5. Remove Somali stopwords",
        "6. TF-IDF fit / transform",
        "7. Train/Test split 80/20",
        "8. Ready for model training",
    ]
    for i, t in enumerate(steps):
        y = 8.7 - i * 1.1
        last = i == len(steps) - 1
        ax.add_patch(
            FancyBboxPatch(
                (1.1, y),
                4.8,
                0.8,
                boxstyle="round,pad=0.02,rounding_size=0.1",
                facecolor="#D5F5E3" if last else "#D6EAF8",
                edgecolor="#117A65" if last else "#1F4E79",
                lw=1.4,
            )
        )
        ax.text(3.5, y + 0.4, t, ha="center", va="center", fontsize=10, fontweight="bold")
        if not last:
            ax.annotate(
                "",
                xy=(3.5, y - 0.28),
                xytext=(3.5, y),
                arrowprops=dict(arrowstyle="->", lw=1.3, color="#2C3E50"),
            )
    save(fig, "fig3_5_preprocessing.png")


def fig_usecase():
    fig, ax = plt.subplots(figsize=(11, 9))
    ax.set_xlim(0, 11)
    ax.set_ylim(0, 9)
    ax.axis("off")
    ax.set_title("Use Case Diagram — BAREAI", fontsize=13, fontweight="bold", pad=12)
    ax.add_patch(Rectangle((2.9, 0.6), 5.2, 7.7, fill=False, linestyle="--", lw=1.5, edgecolor="#34495E"))
    ax.text(5.5, 8.05, "BAREAI System", ha="center", fontsize=11, fontweight="bold")

    def stick(x, y, name):
        ax.add_patch(Circle((x, y + 0.45), 0.22, fill=False, lw=1.4, edgecolor="#1C2833"))
        ax.plot([x, x], [y + 0.23, y - 0.1], color="#1C2833", lw=1.4)
        ax.plot([x - 0.22, x + 0.22], [y + 0.05, y + 0.05], color="#1C2833", lw=1.4)
        ax.plot([x, x - 0.18], [y - 0.1, y - 0.45], color="#1C2833", lw=1.4)
        ax.plot([x, x + 0.18], [y - 0.1, y - 0.45], color="#1C2833", lw=1.4)
        ax.text(x, y - 0.75, name, ha="center", fontsize=8, fontweight="bold")

    stick(1.0, 6.6, "Admin")
    stick(1.0, 4.0, "Investigator")
    stick(1.0, 1.5, "Public User")
    stick(10.0, 4.2, "AI Service")

    ucs = [
        (5.5, 7.2, "Manage Users"),
        (5.5, 6.2, "View Dashboard"),
        (5.5, 5.2, "Manage Blacklist"),
        (5.5, 4.2, "Classify Text Report"),
        (5.5, 3.2, "Claim / Investigate Case"),
        (5.5, 2.2, "Flag False Report"),
        (5.5, 1.2, "Public Analysis"),
    ]
    for x, y, t in ucs:
        ax.add_patch(Ellipse((x, y), 3.1, 0.72, facecolor="#EBF5FB", edgecolor="#1A5276", lw=1.2))
        ax.text(x, y, t, ha="center", va="center", fontsize=8)

    for y in [7.2, 6.2, 5.2]:
        ax.plot([1.25, 3.95], [6.8, y], color="#95A5A6", lw=0.8)
    for y in [5.2, 4.2, 3.2, 2.2]:
        ax.plot([1.25, 3.95], [4.2, y], color="#95A5A6", lw=0.8)
    ax.plot([1.25, 3.95], [1.7, 1.2], color="#95A5A6", lw=0.8)
    ax.plot([1.25, 3.95], [1.7, 4.2], color="#95A5A6", lw=0.8)
    ax.plot([7.05, 9.7], [4.2, 4.4], color="#95A5A6", lw=0.8)
    save(fig, "fig3_3_usecase.png")


def fig_database():
    fig, ax = plt.subplots(figsize=(11.5, 7.2))
    ax.set_xlim(0, 11.5)
    ax.set_ylim(0, 7.2)
    ax.axis("off")
    ax.set_title("Logical Database Schema (MongoDB Collections)", fontsize=13, fontweight="bold", pad=14)

    entities = [
        (0.35, 4.3, "User", ["id (PK)", "email, role", "account_status"]),
        (3.05, 4.3, "History", ["id (PK)", "content", "prediction", "confidence"]),
        (5.8, 4.3, "InvestigationCase", ["id (PK)", "history_id (FK)", "status", "assignedOfficer"]),
        (8.7, 4.3, "BlacklistItem", ["id (PK)", "type, value", "priority"]),
        (1.6, 0.6, "Notification", ["id (PK)", "recipient (FK)", "type, read"]),
        (4.55, 0.6, "InvestigationReport", ["id (PK)", "case_id (FK)", "findings"]),
        (7.7, 0.6, "ActivityLog", ["id (PK)", "user (FK)", "action, module"]),
    ]
    for x, y, title, fields in entities:
        h = 0.6 + 0.38 * len(fields)
        ax.add_patch(
            FancyBboxPatch(
                (x, y),
                2.45,
                h,
                boxstyle="round,pad=0.02,rounding_size=0.08",
                facecolor="#FEF9E7",
                edgecolor="#7D6608",
                lw=1.3,
            )
        )
        ax.text(x + 1.225, y + h - 0.3, title, ha="center", fontsize=9, fontweight="bold")
        ax.plot([x + 0.2, x + 2.25], [y + h - 0.5, y + h - 0.5], color="#7D6608", lw=0.8)
        for i, f in enumerate(fields):
            ax.text(x + 1.225, y + h - 0.82 - i * 0.35, f, ha="center", fontsize=8)

    ax.plot([2.8, 3.05], [5.5, 5.5], color="#5D6D7E", lw=1.2)
    ax.plot([5.5, 5.8], [5.5, 5.5], color="#5D6D7E", lw=1.2)
    ax.plot([4.25, 4.25, 2.8], [4.3, 3.4, 3.4], color="#5D6D7E", lw=1.0)
    ax.plot([7.0, 7.0, 5.8], [4.3, 3.4, 3.4], color="#5D6D7E", lw=1.0)
    ax.plot([1.55, 1.55, 2.8], [4.3, 3.4, 3.4], color="#5D6D7E", lw=1.0)
    save(fig, "fig3_4_database.png")


def fig_model_comparison():
    models = ["RF", "GB", "SVM", "LR", "DT", "NB", "KNN"]
    acc = [89.55, 88.40, 86.35, 85.80, 84.75, 83.05, 78.30]
    f1 = [89.55, 88.39, 86.35, 85.80, 84.75, 83.04, 77.57]
    x = np.arange(len(models))
    w = 0.36
    fig, ax = plt.subplots(figsize=(9.5, 5.2))
    ax.bar(x - w / 2, acc, w, label="Accuracy (%)", color="#1F618D")
    ax.bar(x + w / 2, f1, w, label="F1-Score (%)", color="#148F77")
    ax.set_ylabel("Percentage (%)", fontsize=11)
    ax.set_title("Comparative Performance of Classification Models", fontsize=13, fontweight="bold", pad=12)
    ax.set_xticks(x)
    ax.set_xticklabels(models, fontsize=10)
    ax.set_ylim(70, 96)
    ax.legend(loc="upper right")
    ax.grid(axis="y", alpha=0.25)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    plt.tight_layout(pad=1.4)
    save(fig, "fig4_1_model_comparison.png")


def fig_confusion():
    cm = np.array([[896, 104], [104, 896]])
    fig, ax = plt.subplots(figsize=(6, 5.2))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks([0, 1])
    ax.set_yticks([0, 1])
    ax.set_xticklabels(["Crime-related", "Not crime-related"], fontsize=9)
    ax.set_yticklabels(["Crime-related", "Not crime-related"], fontsize=9)
    ax.set_xlabel("Predicted Label", fontsize=10)
    ax.set_ylabel("Actual Label", fontsize=10)
    ax.set_title("Confusion Matrix — Random Forest\n(Test Set n = 2000)", fontsize=12, fontweight="bold")
    for i in range(2):
        for j in range(2):
            ax.text(
                j,
                i,
                str(cm[i, j]),
                ha="center",
                va="center",
                color="white" if cm[i, j] > 400 else "black",
                fontsize=18,
                fontweight="bold",
            )
    plt.colorbar(im, fraction=0.046, pad=0.04)
    plt.tight_layout(pad=1.4)
    save(fig, "fig4_2_confusion_matrix.png")


def fig_class_dist():
    fig, ax = plt.subplots(figsize=(6.2, 4.8))
    ax.pie(
        [5000, 4999],
        labels=["Crime-related\n(5,000)", "Not crime-related\n(4,999)"],
        colors=["#C0392B", "#2980B9"],
        autopct="%1.2f%%",
        startangle=90,
        textprops={"fontsize": 10},
        pctdistance=0.55,
        labeldistance=1.2,
        wedgeprops=dict(edgecolor="white", linewidth=2),
    )
    ax.set_title("Dataset Class Distribution (N = 9,999)", fontsize=12, fontweight="bold", pad=14)
    plt.tight_layout(pad=1.4)
    save(fig, "fig4_3_class_distribution.png")


def fig_dataflow():
    fig, ax = plt.subplots(figsize=(8, 9.5))
    ax.set_xlim(0, 8)
    ax.set_ylim(0, 9.5)
    ax.axis("off")
    ax.set_title("End-to-End Classification and Case Dispatch Flow", fontsize=12, fontweight="bold", pad=12)
    flow = [
        (7.7, "#AED6F1", "1. Input: Text / URL / File / Facebook"),
        (6.5, "#A9DFBF", "2. Express API: extract and validate"),
        (5.3, "#F5B7B1", "3. Flask /predict: TF-IDF + Random Forest"),
        (4.1, "#F9E79F", "4. Result: label + confidence + keywords"),
        (2.9, "#D7BDE2", "5. Save History in MongoDB"),
        (1.7, "#F5CBA7", "6. If crime: create Investigation Case"),
        (0.5, "#D5F5E3", "7. Notify officers and claim case"),
    ]
    for y, c, t in flow:
        ax.add_patch(
            FancyBboxPatch(
                (0.9, y),
                6.2,
                0.9,
                boxstyle="round,pad=0.02,rounding_size=0.1",
                facecolor=c,
                edgecolor="#2C3E50",
                lw=1.2,
            )
        )
        ax.text(4.0, y + 0.45, t, ha="center", va="center", fontsize=10, fontweight="bold")
    for i in range(len(flow) - 1):
        y1 = flow[i][0]
        y2 = flow[i + 1][0] + 0.9
        ax.annotate("", xy=(4, y2), xytext=(4, y1), arrowprops=dict(arrowstyle="->", lw=1.4, color="#2C3E50"))
    save(fig, "fig4_4_dataflow.png")


def fig_deployment():
    fig, ax = plt.subplots(figsize=(9.5, 4.2))
    ax.set_xlim(0, 9.5)
    ax.set_ylim(0, 4.2)
    ax.axis("off")
    ax.set_title("Local Deployment Topology", fontsize=13, fontweight="bold", pad=12)
    ports = [
        (0.4, "#3498DB", "Frontend\nlocalhost:5173\nReact SPA"),
        (3.5, "#27AE60", "Backend\nlocalhost:5000\nExpress REST"),
        (6.6, "#E74C3C", "AI Model\nlocalhost:5001\nFlask + Joblib"),
    ]
    for x, c, t in ports:
        ax.add_patch(
            FancyBboxPatch(
                (x, 1.5),
                2.5,
                1.8,
                boxstyle="round,pad=0.03,rounding_size=0.12",
                facecolor="white",
                edgecolor=c,
                lw=2.2,
            )
        )
        ax.text(x + 1.25, 2.4, t, ha="center", va="center", fontsize=10, fontweight="bold", color=c)
    ax.annotate("", xy=(3.5, 2.4), xytext=(2.9, 2.4), arrowprops=dict(arrowstyle="<->", lw=1.8, color="#2C3E50"))
    ax.annotate("", xy=(6.6, 2.4), xytext=(6.0, 2.4), arrowprops=dict(arrowstyle="<->", lw=1.8, color="#2C3E50"))
    ax.add_patch(
        FancyBboxPatch(
            (2.5, 0.4),
            4.5,
            0.7,
            boxstyle="round,pad=0.02,rounding_size=0.1",
            facecolor="#F5EEF8",
            edgecolor="#5B2C6F",
            lw=1.3,
        )
    )
    ax.text(4.75, 0.75, "MongoDB (crime_detection_system)", ha="center", va="center", fontsize=10, fontweight="bold")
    save(fig, "fig4_5_deployment.png")


def fig_rf_metrics():
    fig, ax = plt.subplots(figsize=(7.2, 4.4))
    metrics = ["Accuracy", "Precision", "Recall", "F1-Score"]
    vals = [89.55, 89.55, 89.55, 89.55]
    colors = ["#1F618D", "#117A65", "#B9770E", "#922B21"]
    bars = ax.barh(metrics, vals, color=colors, height=0.55)
    ax.set_xlim(0, 108)
    ax.set_xlabel("Score (%)")
    ax.set_title("Best Model (Random Forest) Evaluation Metrics", fontsize=12, fontweight="bold", pad=10)
    for b, v in zip(bars, vals):
        ax.text(v + 1.5, b.get_y() + b.get_height() / 2, f"{v:.2f}%", va="center", fontsize=10, fontweight="bold")
    ax.grid(axis="x", alpha=0.25)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    plt.tight_layout(pad=1.4)
    save(fig, "fig4_6_rf_metrics.png")


def ui_card(path, title, rows, accent):
    fig, ax = plt.subplots(figsize=(7.5, 5.4))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 7)
    ax.axis("off")
    ax.add_patch(
        FancyBboxPatch(
            (0.5, 0.35),
            9.0,
            6.3,
            boxstyle="round,pad=0.02,rounding_size=0.15",
            facecolor="#F7F9FA",
            edgecolor="#2C3E50",
            lw=1.8,
        )
    )
    ax.add_patch(Rectangle((0.5, 5.85), 9.0, 0.8, facecolor=accent, edgecolor="none"))
    ax.text(5, 6.25, title, ha="center", va="center", color="white", fontsize=13, fontweight="bold")
    y = 5.25
    for label, value in rows:
        ax.add_patch(
            FancyBboxPatch(
                (1.0, y - 0.55),
                8.0,
                0.72,
                boxstyle="round,pad=0.02,rounding_size=0.08",
                facecolor="white",
                edgecolor="#D5D8DC",
                lw=1,
            )
        )
        ax.text(1.35, y - 0.18, label, fontsize=10, color="#5D6D7E")
        ax.text(8.65, y - 0.18, value, ha="right", fontsize=11, fontweight="bold")
        y -= 0.95
    save(fig, path)


def fig_analysis_ui():
    fig, ax = plt.subplots(figsize=(7.5, 5.4))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 7)
    ax.axis("off")
    ax.add_patch(
        FancyBboxPatch(
            (0.5, 0.35),
            9.0,
            6.3,
            boxstyle="round,pad=0.02,rounding_size=0.15",
            facecolor="#F7F9FA",
            edgecolor="#2C3E50",
            lw=1.8,
        )
    )
    ax.add_patch(Rectangle((0.5, 5.85), 9.0, 0.8, facecolor="#922B21", edgecolor="none"))
    ax.text(5, 6.25, "Crime Text Analysis Result", ha="center", va="center", color="white", fontsize=13, fontweight="bold")
    ax.add_patch(
        FancyBboxPatch(
            (1.0, 3.7),
            8.0,
            1.8,
            boxstyle="round,pad=0.02,rounding_size=0.08",
            facecolor="white",
            edgecolor="#D5D8DC",
            lw=1,
        )
    )
    ax.text(1.3, 5.1, "Input excerpt (Somali):", fontsize=9, color="#5D6D7E")
    ax.text(1.3, 4.35, "weerar ka dhacay degmada Hodan", fontsize=11, style="italic")
    ax.add_patch(
        FancyBboxPatch(
            (1.0, 1.55),
            3.7,
            1.55,
            boxstyle="round,pad=0.02,rounding_size=0.08",
            facecolor="#FADBD8",
            edgecolor="#922B21",
            lw=1.5,
        )
    )
    ax.text(2.85, 2.8, "Prediction", ha="center", fontsize=9, color="#7B241C")
    ax.text(2.85, 2.15, "CRIME-RELATED", ha="center", fontsize=11, fontweight="bold", color="#7B241C")
    ax.add_patch(
        FancyBboxPatch(
            (5.3, 1.55),
            3.7,
            1.55,
            boxstyle="round,pad=0.02,rounding_size=0.08",
            facecolor="#D5F5E3",
            edgecolor="#117A65",
            lw=1.5,
        )
    )
    ax.text(7.15, 2.8, "Confidence", ha="center", fontsize=9, color="#0E6655")
    ax.text(7.15, 2.15, "92.4%", ha="center", fontsize=16, fontweight="bold", color="#0E6655")
    ax.text(5, 0.9, "Matched keyword: weerar   |   Location: Hodan", ha="center", fontsize=9)
    save(fig, "fig4_8_analysis_ui.png")


if __name__ == "__main__":
    fig_architecture()
    fig_pipeline()
    fig_preprocessing()
    fig_usecase()
    fig_database()
    fig_model_comparison()
    fig_confusion()
    fig_class_dist()
    fig_dataflow()
    fig_deployment()
    fig_rf_metrics()
    ui_card(
        "fig4_7_dashboard_ui.png",
        "BAREAI Admin Dashboard",
        [
            ("Total Analyses", "12,480"),
            ("Crime Detected", "3,912"),
            ("Active Cases", "47"),
            ("Investigators Online", "9"),
            ("Blacklist Items", "126"),
        ],
        "#1F4E79",
    )
    fig_analysis_ui()
    ui_card(
        "fig4_9_cases_ui.png",
        "Investigation Case Board",
        [
            ("CASE-2041", "Pending Claim"),
            ("CASE-2038", "Investigating"),
            ("CASE-2033", "Crime Confirmed"),
            ("CASE-2029", "False Report Flag"),
            ("CASE-2021", "Closed"),
        ],
        "#117A65",
    )
    print("ALL CLEAN FIGURES DONE")
