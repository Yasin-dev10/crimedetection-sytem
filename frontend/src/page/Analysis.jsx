import { useEffect, useState } from "react";
import {
  Link as LinkIcon,
  FileText,
  Loader2,
  Upload,
  Layers,
  History,
  Send,
  LogIn,
  FileSpreadsheet,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import API from "../api";
import { getStoredUser } from "../theme";
import { renderCrimeHighlightedText } from "../utils/crimeHighlight";
import { assertSomaliOnly, SOMALI_ONLY_MESSAGE } from "../utils/somaliLanguage";
import { sanitizeDecisionText } from "../utils/sanitizeDecisionText";
import { exportDataset } from "../services";

export default function Analysis({ publicMode = false, embedded = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getStoredUser();
  const isGuest = !user;
  const canSendToCase =
    !isGuest &&
    (user?.role === "admin" || user?.role === "investigator");
  const canOpenHistory = !isGuest;
  const historyQueryId = new URLSearchParams(location.search).get("history");
  const historyItem = location.state?.historyItem;
  const initialHistoryState = getHistoryInitialState(historyItem);
  const [type, setType] = useState(initialHistoryState.type);

  const [text, setText] = useState(initialHistoryState.text);
  const [url, setUrl] = useState(initialHistoryState.url);
  const [file, setFile] = useState(null);
  const [batchType, setBatchType] = useState("text");
  const [batchInput, setBatchInput] = useState(initialHistoryState.batchInput);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(initialHistoryState.result);
  const [batchResults, setBatchResults] = useState([]);
  const [error, setError] = useState("");
  const [needsAccount, setNeedsAccount] = useState(false);
  const [sendingCase, setSendingCase] = useState(false);
  const [exportingDataset, setExportingDataset] = useState(false);
  const [loadedFromHistory, setLoadedFromHistory] = useState(
    initialHistoryState.loadedFromHistory
  );

  useEffect(() => {
    if (historyItem || !historyQueryId || isGuest) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await API.get("/history");
        const list = Array.isArray(res.data) ? res.data : [];
        const found = list.find((item) => String(item._id) === String(historyQueryId));
        if (cancelled || !found) return;

        const next = getHistoryInitialState(found);
        setType(next.type);
        setText(next.text);
        setUrl(next.url);
        setBatchInput(next.batchInput);
        setResult(next.result);
        setLoadedFromHistory(next.loadedFromHistory);
        setBatchResults([]);
        setError("");
      } catch {
        if (!cancelled) {
          setError("Could not load the linked analysis record.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [historyItem, historyQueryId, isGuest]);

  const resetResults = () => {
    setResult(null);
    setBatchResults([]);
    setError("");
    setNeedsAccount(false);
    setLoadedFromHistory(false);
  };

  const sendResultToCase = async () => {
    if (!result?.historyId || sendingCase) return;

    try {
      setSendingCase(true);
      setError("");
      const res = await API.post("/investigation/cases", {
        historyId: result.historyId,
      });
      const caseId = res.data?.case?._id;
      navigate(caseId ? `/cases?case=${caseId}` : "/cases");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to send to Case Management. Open Reports or Cases to retry."
      );
    } finally {
      setSendingCase(false);
    }
  };

  const downloadDatasetExcel = async () => {
    if (isGuest || exportingDataset) return;
    try {
      setExportingDataset(true);
      setError("");
      const canSeeAll =
        user?.role === "admin" || user?.role === "investigator";
      const res = await exportDataset({
        format: "xlsx",
        source: "all",
        scope: canSeeAll ? "all" : "mine",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `BAREAI-dataset-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to export dataset Excel.");
    } finally {
      setExportingDataset(false);
    }
  };

  const handleAnalyze = async (e) => {
    e.preventDefault();

    if (isGuest) {
      if (getGuestUsage() >= GUEST_FREE_LIMIT) {
        setNeedsAccount(true);
        setError(
          "Waxaad isticmaashay 2 analysis ee bilaashka ah. Samee akoon si aad u sii waddo."
        );
        return;
      }

      if (type === "text" && text.length > GUEST_MAX_TEXT_LENGTH) {
        setError(
          `Martiga waxaa loo xadiday ${GUEST_MAX_TEXT_LENGTH} xaraf (adhigaagu waa ${text.length}). Samee akoon si aad u hesho analysis xadidan.`
        );
        setNeedsAccount(true);
        return;
      }
    }

    if (type === "text") {
      const languageCheck = assertSomaliOnly(text);
      if (!languageCheck.ok) {
        setError(languageCheck.message || SOMALI_ONLY_MESSAGE);
        return;
      }
    }

    if (type === "batch" && batchType === "text") {
      const items = batchInput
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean);
      const rejected = items.find((item) => !assertSomaliOnly(item).ok);
      if (rejected) {
        setError(SOMALI_ONLY_MESSAGE);
        return;
      }
    }

    setLoading(true);
    resetResults();

    try {
      let res;

      if (type === "text") {
        res = await API.post("/analysis/text", { text });
        setResult(buildAnalysisResult(res.data, "text", text));
      }

      if (type === "url") {
        res = await API.post("/analysis/url", { url });
        setResult(buildAnalysisResult(res.data, "url", url));
      }

      if (type === "file") {
        if (!file) {
          setError("Fadlan marka hore dooro fayl");
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", file);

        res = await API.post("/analysis/file", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        setResult(buildAnalysisResult(res.data, "file", file.name));
      }

      if (type === "batch") {
        const items = batchInput
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean);

        if (items.length === 0) {
          setError("Fadlan geli ugu yaraan hal qoraal ama URL");
          setLoading(false);
          return;
        }

        res = await API.post("/analysis/batch", {
          type: batchType,
          items,
        });

        setBatchResults(res.data.results || []);
        const failedLanguage = (res.data.results || []).find(
          (item) => item.languageRejected || item.success === false
        );
        if (failedLanguage?.message) {
          setError(failedLanguage.message);
        }
      }

      if (isGuest) incrementGuestUsage(type === "batch" ? 2 : 1);
    } catch (err) {
      if (err.response?.data?.requiresAccount) {
        setGuestUsage(GUEST_FREE_LIMIT);
        setNeedsAccount(true);
      }
      setError(err.response?.data?.message || "Analysis wuu fashilmay");
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { key: "text", label: "Text", icon: FileText },
    { key: "url", label: "URL", icon: LinkIcon },
    { key: "file", label: "File", icon: Upload },
    { key: "batch", label: "Batch", icon: Layers },
  ];

  const fieldStyle = {
    backgroundColor: "var(--bg-elevated)",
    borderColor: "var(--border-base)",
    color: "var(--text-primary)",
  };

  const tabStyle = (active) => ({
    backgroundColor: active ? "var(--brand)" : "var(--bg-elevated)",
    color: active ? "#ffffff" : "var(--text-secondary)",
    borderColor: active ? "var(--brand)" : "var(--border-base)",
  });

  return (
    <div
      className={`font-sans transition-colors duration-300 ${
        embedded || publicMode ? "p-0" : "w-full"
      }`}
      style={{
        background: embedded || publicMode ? "transparent" : "var(--bg-base)",
        color: "var(--text-primary)",
      }}
      data-theme={publicMode || embedded ? "light" : undefined}
    >
      {!embedded && (
        <div className="page-header">
          <div>
            <h1 className="page-title">Crime Text Analysis</h1>
            <p className="page-subtitle">
              {publicMode
                ? "Enter Somali text for crime analysis. English and other languages are not accepted."
                : "Analyze text, a URL, a file, or a batch. Somali-language content only."}
            </p>
          </div>
          {user?.role === "dataset_manager" && (
            <button
              type="button"
              onClick={downloadDatasetExcel}
              disabled={exportingDataset}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold border transition-colors disabled:opacity-50"
              style={{
                backgroundColor: "var(--brand-soft)",
                borderColor: "var(--brand-ring)",
                color: "var(--text-primary)",
              }}
              title="Download saved analyses as Excel dataset"
            >
              {exportingDataset ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <FileSpreadsheet size={18} />
              )}
              {exportingDataset ? "Exporting…" : "Download Dataset Excel"}
            </button>
          )}
        </div>
      )}

      {loadedFromHistory && (
        <div
          className="mb-4 rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: "var(--brand-ring)",
            backgroundColor: "var(--brand-soft)",
            color: "var(--text-secondary)",
          }}
        >
          History record opened. Previous data has been filled in; you can
          review it or analyze again.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = type === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setType(tab.key);
                    resetResults();
                  }}
                  className="px-4 py-2.5 rounded-xl font-semibold border transition-colors"
                  style={tabStyle(active)}
                >
                  <Icon className="inline mr-2" size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleAnalyze}>
            {type === "text" && (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
                rows="8"
                placeholder="Enter Somali text only (English is not accepted)..."
                className="w-full p-4 rounded-2xl border placeholder:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
                style={fieldStyle}
              />
            )}

            {type === "url" && (
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                placeholder="Enter the URL of a Somali-language page..."
                className="w-full p-4 rounded-2xl border placeholder:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
                style={fieldStyle}
              />
            )}

            {type === "file" && (
              <div
                className="border-2 border-dashed rounded-2xl p-4"
                style={{
                  borderColor: "var(--border-base)",
                  backgroundColor: "var(--bg-elevated)",
                }}
              >
                <Upload className="mb-3 brand-text" size={34} />
                <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>
                  Upload a file
                </h3>
                <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                  The file must contain Somali text. Supported files: PDF, DOC, DOCX, TXT, CSV, JSON, HTML, MD, RTF, XLSX
                </p>

                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.csv,.json,.html,.htm,.md,.markdown,.rtf,.xlsx"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="block w-full text-sm"
                  style={{ color: "var(--text-secondary)" }}
                />

                {file && (
                  <p className="mt-3 text-sm font-medium brand-text">
                    Selected: {file.name}
                  </p>
                )}
              </div>
            )}

            {type === "batch" && (
              <div>
                <div className="flex gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setBatchType("text")}
                    className="px-4 py-2 rounded-xl font-semibold border transition-colors"
                    style={tabStyle(batchType === "text")}
                  >
                    Text Batch
                  </button>

                  <button
                    type="button"
                    onClick={() => setBatchType("url")}
                    className="px-4 py-2 rounded-xl font-semibold border transition-colors"
                    style={tabStyle(batchType === "url")}
                  >
                    URL Batch
                  </button>
                </div>

                <textarea
                  value={batchInput}
                  onChange={(e) => setBatchInput(e.target.value)}
                  required
                  rows="8"
                  placeholder={
                    batchType === "text"
                      ? "Enter Somali texts, one per line..."
                      : "Enter Somali-language page URLs, one per line..."
                  }
                  className="w-full p-4 rounded-2xl border placeholder:opacity-50 focus:outline-none focus:ring-2 focus:ring-[var(--brand-ring)]"
                  style={fieldStyle}
                />
              </div>
            )}

            {error && (
              <div className="mt-4 p-4 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30">
                {error}
                {needsAccount && (
                  <Link
                    to="/register"
                    className="mt-3 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                    style={{ backgroundColor: "var(--brand)" }}
                  >
                    <LogIn size={16} />
                    Create a free account
                  </Link>
                )}
              </div>
            )}

            {isGuest && !needsAccount && (
              <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
                Free trial: {Math.max(0, GUEST_FREE_LIMIT - getGuestUsage())} of{" "}
                {GUEST_FREE_LIMIT} analyses remaining. Guest text is limited to{" "}
                {GUEST_MAX_TEXT_LENGTH} characters. Language: Somali only.
              </p>
            )}

            <p className="mt-3 text-xs font-medium" style={{ color: "var(--brand)" }}>
              Rule: The content must be in Somali. English and other languages are
              not accepted.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="mt-5 btn-primary px-6 py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Analyzing...
                </>
              ) : (
                loadedFromHistory ? "Analyze Again" : "Analyze"
              )}
            </button>
          </form>
        </div>

        <div className="card p-4">
          {result && (
            <div className={resultCardClass(result)}>
              <p
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Decision
              </p>
              <span className={decisionBadgeClass(result)}>
                {formatDecision(result)}
              </span>

              <p
                className="w-full whitespace-pre-wrap break-words rounded-xl px-3 py-3 text-left text-sm leading-6 border"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "var(--border-base)",
                  color: "var(--text-primary)",
                }}
              >
                {result.postText
                  ? renderCrimeHighlightedText(
                      result.postText,
                      isCrimeResult(result),
                      { matchedKeyword: result.matchedKeyword }
                    )
                  : "No post text found"}
              </p>

              <div className="mt-2 flex w-full flex-col gap-2">
                {canOpenHistory ? (
                  <button
                    type="button"
                    onClick={() => navigate("/history")}
                    className="btn-secondary justify-center"
                  >
                    <History size={16} />
                    View History
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="btn-secondary justify-center"
                  >
                    <LogIn size={16} />
                    Sign in to save history
                  </Link>
                )}
                {canSendToCase && result.historyId && (
                  <button
                    type="button"
                    disabled={sendingCase}
                    onClick={sendResultToCase}
                    className="btn-primary justify-center"
                  >
                    <Send size={16} />
                    {sendingCase ? "Sending..." : "Send to Case Management"}
                  </button>
                )}
              </div>
            </div>
          )}

          {!result && batchResults.length === 0 && (
            <div
              className="mt-1 min-h-32 rounded-2xl border p-5 flex flex-col items-center justify-center text-center gap-3"
              style={{ borderColor: "var(--border-base)" }}
            >
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No analysis results found
              </p>
            </div>
          )}
        </div>
      </div>

      {batchResults.length > 0 && (
        <div className="mt-4 card p-4">
          <h2 className="text-lg font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            Batch Results
          </h2>

          <div className="space-y-3">
            {batchResults.map((item, index) => {
              const isCrime = isCrimeLike(
                item.result?.rawPrediction || item.result?.prediction,
                item.result?.isCrime ?? item.result?.is_crime
              );

              return (
                <div
                  key={index}
                  className="flex flex-col items-start justify-between gap-3 p-3 rounded-xl border sm:flex-row sm:items-center"
                  style={{
                    backgroundColor: "var(--bg-elevated)",
                    borderColor: "var(--border-base)",
                  }}
                >
                  <div>
                    <p className="font-medium break-all" style={{ color: "var(--text-primary)" }}>
                      {item.input}
                    </p>
                    <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--text-muted)" }}>
                      {item.success
                        ? renderCrimeHighlightedText(
                            getDisplayText({
                              type: batchType,
                              input: item.input,
                              extractedText: item.result?.postText || item.postText,
                            }),
                            isCrime,
                            {
                              matchedKeyword:
                                item.result?.matchedKeyword || item.matchedKeyword,
                            }
                          )
                        : item.error}
                    </p>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold border ${
                      item.success
                        ? isCrime
                          ? "bg-red-500/10 text-red-400 border-red-500/30"
                          : "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                        : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                    }`}
                  >
                    {item.success ? (isCrime ? "Crime" : "Not-crime") : "FAILED"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const GUEST_FREE_LIMIT = 2;
const GUEST_MAX_TEXT_LENGTH = 1000;
const GUEST_USAGE_KEY = "bareai_guest_analyses";

function getGuestUsage() {
  const value = Number(localStorage.getItem(GUEST_USAGE_KEY));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function setGuestUsage(value) {
  localStorage.setItem(GUEST_USAGE_KEY, String(value));
}

function incrementGuestUsage(amount = 1) {
  setGuestUsage(getGuestUsage() + amount);
}

function isCrimeResult(result) {
  return result?.isCrime === true || isCrimeLike(result?.rawPrediction || result?.prediction);
}

function isCrimeLike(prediction, explicitValue) {
  if (explicitValue === true) return true;
  if (explicitValue === false) return false;

  const normalized = String(prediction || "").trim().toLowerCase();
  if (!normalized || normalized.startsWith("not ")) return false;

  return [
    "crime",
    "crime-related",
    "crime related",
    "criminal",
    "1",
    "yes",
    "true",
  ].includes(normalized);
}

function resultCardClass(result) {
  const base =
    "min-h-32 rounded-2xl border p-5 flex flex-col items-center justify-center text-center gap-3";

  if (isCrimeResult(result)) {
    return `${base} bg-red-500/10 border-red-500/40`;
  }

  return `${base} bg-emerald-500/10 border-emerald-500/40`;
}

function decisionBadgeClass(result) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-lg font-black tracking-wide";

  if (isCrimeResult(result)) {
    return `${base} bg-red-600 text-white`;
  }

  return `${base} bg-emerald-600 text-white`;
}

function buildAnalysisResult(data, type, input) {
  const result = data?.result || {};
  const isCrime = isCrimeLike(
    result.rawPrediction || result.prediction,
    result.isCrime ?? result.is_crime
  );

  return {
    prediction: isCrime ? "Crime" : "Not-crime",
    type,
    historyId: data?.historyId,
    isCrime,
    rawPrediction: result.rawPrediction || result.prediction,
    fileName: data?.file || (type === "file" ? input : null),
    postText: getDisplayText({
      type,
      input,
      extractedText: result.postText || data?.postText || data?.extractedText,
    }),
  };
}

function formatDecision(result) {
  return isCrimeResult(result) ? "Crime" : "Not-crime";
}

function getDisplayText({ type, input, extractedText }) {
  if (type === "url" || type === "file" || type === "batch") {
    return sanitizeDecisionText(extractedText || input || "");
  }

  return sanitizeDecisionText(input || extractedText || "");
}

function getHistoryInitialState(historyItem) {
  if (!historyItem) {
    return {
      type: "text",
      text: "",
      url: "",
      batchInput: "",
      result: null,
      loadedFromHistory: false,
    };
  }

  const historyType = historyItem.type?.toLowerCase() || "text";
  const normalizedType = ["text", "url", "file", "batch"].includes(historyType)
    ? historyType
    : "text";
  const historyIsCrime = isCrimeLike(
    historyItem.rawPrediction || historyItem.prediction,
    historyItem.isCrime
  );

  return {
    type: normalizedType,
    text: normalizedType === "text" ? historyItem.content || "" : "",
    url: normalizedType === "url" ? historyItem.content || "" : "",
    batchInput: normalizedType === "batch" ? historyItem.content || "" : "",
    result: {
      prediction: historyIsCrime ? "Crime" : "Not-crime",
      type: normalizedType,
      historyId: historyItem._id || historyItem.id || null,
      isCrime: historyIsCrime,
      rawPrediction: historyItem.rawPrediction || historyItem.prediction,
      fileName: normalizedType === "file" ? historyItem.content : null,
      postText: getDisplayText({
        type: normalizedType,
        input: historyItem.content,
        extractedText: historyItem.extractedText,
      }),
    },
    loadedFromHistory: true,
  };
}
