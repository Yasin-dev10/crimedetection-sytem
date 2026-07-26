"""Generate corrected architecture + complete website UI screenshots."""
import os
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Rectangle, Circle
import numpy as np

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "thesis_figures"
OUT.mkdir(exist_ok=True)


def save(fig, name):
    path = OUT / name
    fig.savefig(path, dpi=220, bbox_inches="tight", facecolor="white", pad_inches=0.35)
    # also save beside script for compatibility
    fig.savefig(ROOT / name, dpi=220, bbox_inches="tight", facecolor="white", pad_inches=0.35)
    plt.close(fig)
    print("saved", name)


def fig_architecture_pipeline():
    """Correction #12: full pipeline from social media to web app."""
    fig, ax = plt.subplots(figsize=(7.2, 11))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 14)
    ax.axis("off")
    ax.set_title("BAREAI System Architecture Pipeline", fontsize=14, fontweight="bold", pad=14)

    steps = [
        (12.4, "#D6EAF8", "#1F4E79", "Social Media Data\n(Facebook posts, websites, text reports)"),
        (10.7, "#D5F5E3", "#117A65", "Data Collection\n(URL scrape, file upload, batch, monitors)"),
        (9.0, "#FCF3CF", "#B7950B", "Data Preprocessing\n(cleaning, stopwords, normalisation)"),
        (7.3, "#FADBD8", "#922B21", "Feature Extraction\n(TF-IDF vectorisation)"),
        (5.6, "#D7BDE2", "#5B2C6F", "Machine Learning Model\n(Random Forest classifier)"),
        (3.9, "#F5CBA7", "#AF601A", "Crime / Non-Crime Classification\n(label + confidence + keywords)"),
        (2.2, "#AED6F1", "#1A5276", "Web Application (BAREAI)\n(Dashboard, cases, blacklist, reports)"),
    ]
    for y, fc, ec, text in steps:
        ax.add_patch(
            FancyBboxPatch(
                (1.2, y),
                7.6,
                1.35,
                boxstyle="round,pad=0.02,rounding_size=0.12",
                facecolor=fc,
                edgecolor=ec,
                lw=1.8,
            )
        )
        ax.text(5, y + 0.68, text, ha="center", va="center", fontsize=10, fontweight="bold")
    for i in range(len(steps) - 1):
        y1 = steps[i][0]
        y2 = steps[i + 1][0] + 1.35
        ax.annotate("", xy=(5, y2), xytext=(5, y1), arrowprops=dict(arrowstyle="->", lw=1.8, color="#2C3E50"))
    save(fig, "fig3_1_architecture.png")


def browser_frame(ax, title, accent="#1F4E79"):
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 8)
    ax.axis("off")
    # window
    ax.add_patch(FancyBboxPatch((0.3, 0.3), 11.4, 7.4, boxstyle="round,pad=0.02,rounding_size=0.08",
                                facecolor="#F4F6F7", edgecolor="#2C3E50", lw=1.6))
    # title bar
    ax.add_patch(Rectangle((0.3, 7.1), 11.4, 0.6, facecolor=accent, edgecolor="none"))
    ax.text(6, 7.4, title, ha="center", va="center", color="white", fontsize=12, fontweight="bold")
    # traffic lights
    for x, c in [(0.6, "#E74C3C"), (1.0, "#F1C40F"), (1.4, "#2ECC71")]:
        ax.add_patch(Circle((x, 7.4), 0.1, color=c))


def ui_landing():
    fig, ax = plt.subplots(figsize=(10, 6.5))
    browser_frame(ax, "BAREAI — Intelligence Platform | Home", "#0E4D6C")
    ax.text(6, 6.3, "BAREAI", ha="center", fontsize=28, fontweight="bold", color="#0E4D6C")
    ax.text(6, 5.7, "Automatic Classification of Crime-Related Text Reports Using NLP",
            ha="center", fontsize=10, color="#34495E")
    ax.text(6, 5.2, "Classify social media posts as Crime-related or Non-crime-related",
            ha="center", fontsize=11, style="italic", color="#1F618D")
    # feature cards
    feats = [("Text Analysis", "Paste Somali/English text"), ("File Analysis", "PDF / DOCX / TXT"),
             ("URL Analysis", "Scrape webpage text"), ("Batch Analysis", "Multiple reports")]
    xs = [1.0, 3.8, 6.6, 9.2]
    for x, (t, s) in zip(xs, feats):
        ax.add_patch(FancyBboxPatch((x, 2.8), 2.4, 1.8, boxstyle="round,pad=0.02,rounding_size=0.1",
                                    facecolor="white", edgecolor="#AED6F1", lw=1.3))
        ax.text(x + 1.2, 4.1, t, ha="center", fontsize=9, fontweight="bold", color="#1A5276")
        ax.text(x + 1.2, 3.4, s, ha="center", fontsize=8, color="#5D6D7E")
    ax.add_patch(FancyBboxPatch((4.2, 1.2), 3.6, 0.9, boxstyle="round,pad=0.02,rounding_size=0.1",
                                facecolor="#1F4E79", edgecolor="#1F4E79", lw=1))
    ax.text(6, 1.65, "Start Free Analysis", ha="center", va="center", color="white", fontsize=11, fontweight="bold")
    save(fig, "fig4_10_landing.png")


def ui_login():
    fig, ax = plt.subplots(figsize=(9, 6))
    browser_frame(ax, "BAREAI | Login", "#1F4E79")
    ax.add_patch(FancyBboxPatch((3.5, 1.8), 5.0, 4.5, boxstyle="round,pad=0.02,rounding_size=0.12",
                                facecolor="white", edgecolor="#BFC9CA", lw=1.2))
    ax.text(6, 5.8, "Sign In", ha="center", fontsize=16, fontweight="bold", color="#1F4E79")
    for y, label, val in [(4.8, "Email", "admin@bareai.so"), (3.7, "Password", "********")]:
        ax.text(3.9, y + 0.45, label, fontsize=9, color="#5D6D7E")
        ax.add_patch(FancyBboxPatch((3.9, y - 0.15), 4.2, 0.55, boxstyle="round,pad=0.02,rounding_size=0.06",
                                    facecolor="#F8F9F9", edgecolor="#D5D8DC", lw=1))
        ax.text(4.1, y + 0.1, val, fontsize=10, color="#2C3E50")
    ax.add_patch(FancyBboxPatch((3.9, 2.3), 4.2, 0.65, boxstyle="round,pad=0.02,rounding_size=0.08",
                                facecolor="#1F4E79", edgecolor="#1F4E79"))
    ax.text(6, 2.62, "Login", ha="center", va="center", color="white", fontsize=11, fontweight="bold")
    save(fig, "fig4_11_login.png")


def ui_analysis():
    fig, ax = plt.subplots(figsize=(10, 6.5))
    browser_frame(ax, "BAREAI | Public / User Analysis", "#922B21")
    # tabs
    for i, t in enumerate(["Text", "URL", "File", "Batch"]):
        x = 1.0 + i * 2.5
        fc = "#922B21" if i == 0 else "#D5D8DC"
        tc = "white" if i == 0 else "#2C3E50"
        ax.add_patch(FancyBboxPatch((x, 6.2), 2.2, 0.55, boxstyle="round,pad=0.02,rounding_size=0.06",
                                    facecolor=fc, edgecolor=fc))
        ax.text(x + 1.1, 6.47, t + " Analysis", ha="center", va="center", color=tc, fontsize=9, fontweight="bold")
    ax.add_patch(FancyBboxPatch((1.0, 3.6), 10.0, 2.3, boxstyle="round,pad=0.02,rounding_size=0.08",
                                facecolor="white", edgecolor="#D5D8DC"))
    ax.text(1.3, 5.5, "Paste social media post / crime report text:", fontsize=9, color="#5D6D7E")
    ax.text(1.3, 4.7, "weerar ka dhacay degmada Hodan oo dad badan ku dhinteen...",
            fontsize=10, style="italic")
    ax.add_patch(FancyBboxPatch((1.0, 2.5), 4.5, 0.8, boxstyle="round,pad=0.02,rounding_size=0.08",
                                facecolor="#1F4E79", edgecolor="#1F4E79"))
    ax.text(3.25, 2.9, "Classify Report", ha="center", va="center", color="white", fontsize=11, fontweight="bold")
    ax.add_patch(FancyBboxPatch((6.0, 1.0), 5.0, 2.2, boxstyle="round,pad=0.02,rounding_size=0.1",
                                facecolor="#FADBD8", edgecolor="#922B21", lw=1.5))
    ax.text(8.5, 2.7, "Result: CRIME-RELATED", ha="center", fontsize=12, fontweight="bold", color="#7B241C")
    ax.text(8.5, 2.1, "Confidence: 92.4%", ha="center", fontsize=11, color="#7B241C")
    ax.text(8.5, 1.5, "Class: Crime-related  |  Non-crime-related", ha="center", fontsize=8, color="#5D6D7E")
    save(fig, "fig4_8_analysis_ui.png")


def ui_dashboard():
    fig, ax = plt.subplots(figsize=(10, 6.5))
    browser_frame(ax, "BAREAI | Admin Dashboard", "#1F4E79")
    # sidebar
    ax.add_patch(Rectangle((0.3, 0.3), 2.4, 6.8, facecolor="#1C2833", edgecolor="none"))
    for i, item in enumerate(["Dashboard", "Users", "Cases", "Blacklist", "Reports", "Audit Logs"]):
        ax.text(1.5, 6.5 - i * 0.7, item, ha="center", color="white", fontsize=9)
    cards = [("Total Analyses", "12,480"), ("Crime Detected", "3,912"),
             ("Active Cases", "47"), ("Investigators", "9")]
    for i, (lab, val) in enumerate(cards):
        x = 3.0 + (i % 2) * 4.3
        y = 5.0 - (i // 2) * 2.0
        ax.add_patch(FancyBboxPatch((x, y), 3.9, 1.6, boxstyle="round,pad=0.02,rounding_size=0.1",
                                    facecolor="white", edgecolor="#AED6F1", lw=1.2))
        ax.text(x + 1.95, y + 1.1, lab, ha="center", fontsize=9, color="#5D6D7E")
        ax.text(x + 1.95, y + 0.55, val, ha="center", fontsize=18, fontweight="bold", color="#1F4E79")
    save(fig, "fig4_7_dashboard_ui.png")


def ui_cases():
    fig, ax = plt.subplots(figsize=(10, 6.5))
    browser_frame(ax, "BAREAI | Investigation Case Management", "#117A65")
    headers = ["Case ID", "Source", "Prediction", "Status", "Action"]
    rows = [
        ["CASE-2041", "Facebook", "Crime-related", "Pending", "Claim"],
        ["CASE-2038", "URL", "Crime-related", "Investigating", "Update"],
        ["CASE-2033", "Text", "Crime-related", "Confirmed", "Report"],
        ["CASE-2029", "File", "Non-crime", "False Flag", "Review"],
        ["CASE-2021", "Batch", "Crime-related", "Closed", "View"],
    ]
    # table header
    ax.add_patch(Rectangle((0.8, 5.9), 10.4, 0.55, facecolor="#117A65", edgecolor="none"))
    for i, h in enumerate(headers):
        ax.text(1.5 + i * 2.1, 6.15, h, ha="center", color="white", fontsize=9, fontweight="bold")
    for r, row in enumerate(rows):
        y = 5.2 - r * 0.75
        fc = "white" if r % 2 == 0 else "#E8F8F5"
        ax.add_patch(Rectangle((0.8, y), 10.4, 0.7, facecolor=fc, edgecolor="#D5D8DC", lw=0.5))
        for i, v in enumerate(row):
            ax.text(1.5 + i * 2.1, y + 0.35, v, ha="center", fontsize=8, color="#1C2833")
    save(fig, "fig4_9_cases_ui.png")


def ui_blacklist():
    fig, ax = plt.subplots(figsize=(10, 6.5))
    browser_frame(ax, "BAREAI | Blacklist & Monitoring", "#5B2C6F")
    ax.text(6, 6.4, "Watchlist: Facebook pages | Websites | Keywords | Persons",
            ha="center", fontsize=10, color="#5B2C6F")
    items = [
        ("facebook_page", "Somali News Page X", "High", "Active"),
        ("website", "example-news.so", "Medium", "Active"),
        ("keyword", "qarax / dil / afduub", "High", "Active"),
        ("person", "Suspect Alias", "Low", "Paused"),
    ]
    for i, (typ, name, pri, st) in enumerate(items):
        y = 5.2 - i * 1.0
        ax.add_patch(FancyBboxPatch((1.0, y), 10.0, 0.85, boxstyle="round,pad=0.02,rounding_size=0.08",
                                    facecolor="white", edgecolor="#D7BDE2", lw=1.1))
        ax.text(1.4, y + 0.42, f"{typ}", fontsize=8, color="#7D3C98", fontweight="bold")
        ax.text(4.5, y + 0.42, name, fontsize=10, color="#1C2833")
        ax.text(8.2, y + 0.42, pri, fontsize=9, color="#922B21")
        ax.text(10.2, y + 0.42, st, fontsize=9, color="#117A65")
    save(fig, "fig4_12_blacklist.png")


def ui_url_file_batch():
    # URL
    fig, ax = plt.subplots(figsize=(10, 5.5))
    browser_frame(ax, "BAREAI | URL Analysis", "#1A5276")
    ax.text(1.2, 6.2, "Enter webpage URL to extract and classify text", fontsize=10, color="#5D6D7E")
    ax.add_patch(FancyBboxPatch((1.2, 4.8), 9.0, 0.8, boxstyle="round,pad=0.02,rounding_size=0.06",
                                facecolor="white", edgecolor="#D5D8DC"))
    ax.text(1.5, 5.2, "https://www.bbc.com/somali/articles/...", fontsize=10)
    ax.add_patch(FancyBboxPatch((1.2, 3.5), 3.5, 0.7, boxstyle="round,pad=0.02,rounding_size=0.08",
                                facecolor="#1A5276", edgecolor="#1A5276"))
    ax.text(2.95, 3.85, "Analyse URL", ha="center", va="center", color="white", fontweight="bold")
    ax.add_patch(FancyBboxPatch((1.2, 1.2), 9.0, 1.8, boxstyle="round,pad=0.02,rounding_size=0.1",
                                facecolor="#EBF5FB", edgecolor="#1A5276"))
    ax.text(5.7, 2.4, "Extracted text classified as: CRIME-RELATED (88.1%)",
            ha="center", fontsize=11, fontweight="bold", color="#1A5276")
    ax.text(5.7, 1.7, "Source type: URL  |  Output: Crime-related / Non-crime-related",
            ha="center", fontsize=9, color="#5D6D7E")
    save(fig, "fig4_13_url_analysis.png")

    # File
    fig, ax = plt.subplots(figsize=(10, 5.5))
    browser_frame(ax, "BAREAI | File Analysis", "#117A65")
    ax.text(6, 5.8, "Upload PDF, DOCX, or TXT crime report", ha="center", fontsize=11, color="#5D6D7E")
    ax.add_patch(FancyBboxPatch((3.0, 2.8), 6.0, 2.4, boxstyle="round,pad=0.02,rounding_size=0.12",
                                facecolor="white", edgecolor="#117A65", lw=1.5, linestyle="--"))
    ax.text(6, 4.3, "Drop file here", ha="center", fontsize=14, fontweight="bold", color="#117A65")
    ax.text(6, 3.6, "report_hodan.pdf  (245 KB)", ha="center", fontsize=10, color="#2C3E50")
    ax.add_patch(FancyBboxPatch((4.2, 1.3), 3.6, 0.7, boxstyle="round,pad=0.02,rounding_size=0.08",
                                facecolor="#117A65", edgecolor="#117A65"))
    ax.text(6, 1.65, "Upload & Classify", ha="center", va="center", color="white", fontweight="bold")
    save(fig, "fig4_14_file_analysis.png")

    # Batch
    fig, ax = plt.subplots(figsize=(10, 5.5))
    browser_frame(ax, "BAREAI | Batch Analysis", "#AF601A")
    ax.text(6, 6.2, "Classify multiple social media posts in one request", ha="center", fontsize=10)
    for i, (txt, pred) in enumerate([
        ("Post 1: tuugo baabuur...", "Crime-related"),
        ("Post 2: ciyaar fudud...", "Non-crime-related"),
        ("Post 3: qarax ka dhacay...", "Crime-related"),
    ]):
        y = 5.0 - i * 1.1
        ax.add_patch(FancyBboxPatch((1.2, y), 9.6, 0.9, boxstyle="round,pad=0.02,rounding_size=0.08",
                                    facecolor="white", edgecolor="#F5CBA7"))
        ax.text(1.5, y + 0.45, txt, fontsize=9, color="#2C3E50")
        color = "#922B21" if "Crime" in pred and "Non" not in pred else "#117A65"
        ax.text(10.2, y + 0.45, pred, ha="right", fontsize=9, fontweight="bold", color=color)
    save(fig, "fig4_15_batch_analysis.png")


def ui_notifications_reports():
    fig, ax = plt.subplots(figsize=(10, 5.8))
    browser_frame(ax, "BAREAI | Notifications & Reports", "#1F4E79")
    ax.add_patch(FancyBboxPatch((1.0, 3.8), 5.0, 2.5, boxstyle="round,pad=0.02,rounding_size=0.1",
                                facecolor="white", edgecolor="#AED6F1"))
    ax.text(3.5, 5.9, "Notifications", ha="center", fontweight="bold", color="#1F4E79")
    ax.text(1.3, 5.3, "• New crime detected — CASE-2041", fontsize=9)
    ax.text(1.3, 4.8, "• Case available for claim", fontsize=9)
    ax.text(1.3, 4.3, "• False report flagged for review", fontsize=9)
    ax.add_patch(FancyBboxPatch((6.3, 3.8), 5.0, 2.5, boxstyle="round,pad=0.02,rounding_size=0.1",
                                facecolor="white", edgecolor="#AED6F1"))
    ax.text(8.8, 5.9, "Operational Reports", ha="center", fontweight="bold", color="#1F4E79")
    ax.text(6.6, 5.3, "• Monthly crime detections", fontsize=9)
    ax.text(6.6, 4.8, "• Investigator workload", fontsize=9)
    ax.text(6.6, 4.3, "• Fake/malicious report log", fontsize=9)
    ax.text(6, 2.5, "Role-based access: Admin | Investigator | Public User",
            ha="center", fontsize=10, color="#5D6D7E")
    ax.text(6, 1.7, "Outputs support triage of Crime-related vs Non-crime-related posts",
            ha="center", fontsize=10, color="#1A5276", fontweight="bold")
    save(fig, "fig4_16_notifications_reports.png")


def extra_flowcharts():
    # Feature analysis flow
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 4)
    ax.axis("off")
    ax.set_title("Multi-Source Input Analysis Features", fontsize=13, fontweight="bold")
    boxes = [
        (0.4, "Text\nAnalysis"),
        (2.8, "File\nAnalysis"),
        (5.2, "URL\nAnalysis"),
        (7.6, "Batch\nAnalysis"),
    ]
    for x, t in boxes:
        ax.add_patch(FancyBboxPatch((x, 1.8), 2.0, 1.3, boxstyle="round,pad=0.02,rounding_size=0.1",
                                    facecolor="#D6EAF8", edgecolor="#1F4E79", lw=1.4))
        ax.text(x + 1.0, 2.45, t, ha="center", va="center", fontsize=10, fontweight="bold")
        ax.annotate("", xy=(5, 1.3), xytext=(x + 1.0, 1.8),
                    arrowprops=dict(arrowstyle="->", color="#2C3E50", lw=1.2))
    ax.add_patch(FancyBboxPatch((3.0, 0.35), 4.0, 0.85, boxstyle="round,pad=0.02,rounding_size=0.1",
                                facecolor="#FADBD8", edgecolor="#922B21", lw=1.4))
    ax.text(5, 0.78, "Crime-related  /  Non-crime-related", ha="center", va="center",
            fontsize=10, fontweight="bold")
    save(fig, "fig3_6_input_features.png")


if __name__ == "__main__":
    fig_architecture_pipeline()
    ui_landing()
    ui_login()
    ui_analysis()
    ui_dashboard()
    ui_cases()
    ui_blacklist()
    ui_url_file_batch()
    ui_notifications_reports()
    extra_flowcharts()
    # regenerate other charts if missing from sibling script
    print("UI + architecture figures done")
