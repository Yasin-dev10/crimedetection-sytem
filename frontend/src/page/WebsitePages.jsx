import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  ClipboardList,
  ExternalLink,
  Loader2,
  Send,
  ShieldAlert,
} from "lucide-react";
import API from "../api";
import { getStoredUser } from "../theme";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 7 }, (_, index) => CURRENT_YEAR - index);
const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Date(2000, index, 1).toLocaleString("en-US", { month: "long" }),
}));

export default function WebsitePages() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getStoredUser();
  const canSendToCase =
    user?.role === "admin" || user?.role === "investigator";

  const [data, setData] = useState({
    item: null,
    summary: { totalPages: 0, crimePages: 0, safePages: 0 },
    pages: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sendingId, setSendingId] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");

  const loadPages = async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (selectedYear) params.set("year", selectedYear);
      if (selectedYear && selectedMonth) params.set("month", selectedMonth);
      const query = params.toString();
      const res = await API.get(
        `/blacklist/website/${id}/pages${query ? `?${query}` : ""}`
      );
      setData(
        res.data || {
          item: null,
          summary: { totalPages: 0, crimePages: 0, safePages: 0 },
          pages: [],
        }
      );
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load website pages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPages();
  }, [id, selectedYear, selectedMonth]);

  const sendToCase = async (page) => {
    if (!page?._id || sendingId) return;

    try {
      setSendingId(page._id);
      setError("");
      setSuccess("");
      const res = await API.post("/investigation/cases", {
        historyId: page._id,
      });
      const caseId = res.data?.case?._id;

      setData((current) => ({
        ...current,
        pages: (current.pages || []).map((item) =>
          item._id === page._id
            ? { ...item, investigationStatus: "sent_to_investigation" }
            : item
        ),
      }));

      setSuccess("Crime page sent to Case Management.");
      navigate(caseId ? `/cases?case=${caseId}` : "/cases");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to send page to Case Management"
      );
    } finally {
      setSendingId("");
    }
  };

  return (
    <div
      className="w-full transition-colors duration-300"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      <div className="mx-auto max-w-7xl">
        <button
          type="button"
          onClick={() => navigate("/blacklist?view=website")}
          className="mb-6 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold"
          style={{
            background: "var(--navy)",
            color: "var(--on-accent)",
            border: "1px solid var(--navy)",
          }}
        >
          <ArrowLeft size={16} />
          Back to Website Scraping
        </button>

        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--brand)" }}
            >
              Website → Reports → Notifications → Case
            </p>
            <h1 className="mt-1 text-3xl font-bold">
              {data.item?.name || "Website Pages"}
            </h1>
            <p className="mt-2 break-all" style={{ color: "var(--brand)" }}>
              {data.item?.value}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/cases")}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-opacity hover:opacity-90"
              style={{ background: "var(--brand)", color: "var(--on-accent)" }}
            >
              <Bell size={16} />
              Case Management
            </button>
            <button
              type="button"
              onClick={() => navigate("/reports")}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-opacity hover:opacity-90"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-base)",
              }}
            >
              <ClipboardList size={16} />
              Reports
            </button>
          </div>
        </div>

        {error && (
          <div
            className="mb-4 rounded-xl p-3 text-sm"
            style={{
              background: "var(--accent-danger-soft)",
              border: "1px solid var(--accent-danger-border)",
              color: "var(--accent-danger)",
            }}
          >
            {error}
          </div>
        )}
        {success && (
          <div
            className="mb-4 rounded-xl p-3 text-sm"
            style={{
              background: "var(--accent-success-soft)",
              border: "1px solid var(--accent-success-border)",
              color: "var(--accent-success)",
            }}
          >
            {success}
          </div>
        )}

        <div
          className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl p-4"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-base)",
          }}
        >
          <div>
            <label
              className="mb-1.5 block text-xs font-bold uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(event) => {
                setSelectedYear(event.target.value);
                if (!event.target.value) setSelectedMonth("");
              }}
              className="rounded-xl px-3 py-2 text-sm"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-base)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">All years</option>
              {YEARS.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label
              className="mb-1.5 block text-xs font-bold uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              disabled={!selectedYear}
              className="rounded-xl px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-base)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">All months</option>
              {MONTHS.map((month) => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </div>
          {(selectedYear || selectedMonth) && (
            <button
              type="button"
              onClick={() => {
                setSelectedYear("");
                setSelectedMonth("");
              }}
              className="rounded-xl px-3 py-2 text-sm font-bold"
              style={{
                border: "1px solid var(--border-base)",
                color: "var(--text-secondary)",
              }}
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="my-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <SummaryCard title="Total Pages" value={data.summary?.totalPages || 0} />
          <SummaryCard title="Crime Pages" value={data.summary?.crimePages || 0} />
          <SummaryCard title="Safe Pages" value={data.summary?.safePages || 0} />
        </div>

        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Loading scanned pages...</p>
        ) : (data.pages || []).length === 0 ? (
          <div
            className="rounded-2xl p-10 text-center"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-base)",
            }}
          >
            <ShieldAlert
              className="mx-auto mb-3"
              size={36}
              style={{ color: "var(--text-muted)" }}
            />
            <p className="font-bold">No pages scanned yet</p>
            <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
              Scan this website from Blacklist, then crime pages appear in
              Notifications.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(data.pages || []).map((page) => {
              const alreadySent =
                page.investigationStatus === "sent_to_investigation" ||
                page.investigationStatus === "under_review" ||
                page.investigationStatus === "crime_case" ||
                page.investigationStatus === "not_crime";
              const predictionLabel = page.isCrime
                ? "CRIME"
                : page.prediction || "NOT CRIME";

              return (
                <div
                  key={page._id}
                  className="rounded-2xl p-5"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-base)",
                    boxShadow: "var(--shadow-card)",
                  }}
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <ShieldAlert
                      size={17}
                      style={{
                        color: page.isCrime
                          ? "var(--accent-danger)"
                          : "var(--accent-success)",
                      }}
                    />
                    <Badge color={page.isCrime ? "red" : "green"}>
                      {predictionLabel}
                    </Badge>
                    <Badge color="cyan">{page.confidence || 0}%</Badge>
                    {page.investigationStatus && (
                      <Badge color="gray">{page.investigationStatus}</Badge>
                    )}
                    {alreadySent && <Badge color="cyan">Sent to Case</Badge>}
                    <span
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {page.createdAt
                        ? new Date(page.createdAt).toLocaleString()
                        : "—"}
                    </span>
                  </div>

                  {page.url && (
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mb-3 inline-flex max-w-full items-center gap-1.5 text-sm font-medium"
                      style={{ color: "var(--brand)" }}
                    >
                      <ExternalLink size={13} className="shrink-0" />
                      <span className="truncate break-all">{page.url}</span>
                    </a>
                  )}

                  <p
                    className="whitespace-pre-wrap text-sm leading-7"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {page.content || "No content captured."}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {page.url && (
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-opacity hover:opacity-90"
                        style={{
                          background: "var(--bg-surface)",
                          color: "var(--brand)",
                          border: "1px solid var(--border-base)",
                        }}
                      >
                        <ExternalLink size={14} />
                        Open page
                      </a>
                    )}

                    {canSendToCase && page.isCrime && !alreadySent && (
                      <button
                        type="button"
                        disabled={sendingId === page._id}
                        onClick={() => sendToCase(page)}
                        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-60"
                        style={{
                          background: "var(--brand)",
                          color: "var(--on-accent)",
                        }}
                      >
                        {sendingId === page._id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Send size={14} />
                        )}
                        Send to Case
                      </button>
                    )}

                    {canSendToCase && page.isCrime && alreadySent && (
                      <button
                        type="button"
                        onClick={() => navigate("/cases")}
                        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold"
                        style={{
                          background: "var(--brand-soft)",
                          color: "var(--brand)",
                          border: "1px solid var(--brand-ring)",
                        }}
                      >
                        <ClipboardList size={14} />
                        Open Case Management
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ title, value }) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-base)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {title}
      </p>
      <h2 className="mt-2 text-3xl font-bold">{value}</h2>
    </div>
  );
}

function Badge({ children, color }) {
  const tones = {
    red: {
      background: "var(--accent-danger-soft)",
      color: "var(--accent-danger)",
      border: "var(--accent-danger-border)",
    },
    green: {
      background: "var(--accent-success-soft)",
      color: "var(--accent-success)",
      border: "var(--accent-success-border)",
    },
    cyan: {
      background: "var(--brand-soft)",
      color: "var(--brand)",
      border: "var(--brand-ring)",
    },
    gray: {
      background: "var(--bg-elevated)",
      color: "var(--text-muted)",
      border: "var(--border-base)",
    },
  };
  const tone = tones[color] || tones.gray;

  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{
        background: tone.background,
        color: tone.color,
        border: `1px solid ${tone.border}`,
      }}
    >
      {children}
    </span>
  );
}
