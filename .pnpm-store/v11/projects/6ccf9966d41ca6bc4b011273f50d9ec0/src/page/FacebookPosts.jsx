import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bell,
  ClipboardList,
  Loader2,
  Send,
  ShieldAlert,
} from "lucide-react";
import API from "../api";
import { getStoredUser } from "../theme";
import { renderCrimeHighlightedText } from "../utils/crimeHighlight";

const PERIODS = [
  { value: "", label: "All time" },
  { value: "week", label: "Last week" },
  { value: "month", label: "Last month" },
  { value: "year", label: "Last year" },
];

export default function FacebookPosts() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getStoredUser();
  const canSendToCase =
    user?.role === "admin" || user?.role === "investigator";

  const [data, setData] = useState({
    item: null,
    summary: { totalPosts: 0, crimePosts: 0, safePosts: 0 },
    posts: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sendingId, setSendingId] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");

  const loadPosts = async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (selectedPeriod) params.set("period", selectedPeriod);
      const query = params.toString();
      const res = await API.get(
        `/blacklist/facebook/${id}/posts${query ? `?${query}` : ""}`
      );
      setData(res.data || {
        item: null,
        summary: { totalPosts: 0, crimePosts: 0, safePosts: 0 },
        posts: [],
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load Facebook posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [id, selectedPeriod]);

  const sendToCase = async (post) => {
    if (!post?._id || sendingId) return;

    try {
      setSendingId(post._id);
      setError("");
      setSuccess("");
      const res = await API.post("/investigation/cases", {
        historyId: post._id,
      });
      const caseId = res.data?.case?._id;

      setData((current) => ({
        ...current,
        posts: (current.posts || []).map((item) =>
          item._id === post._id
            ? { ...item, investigationStatus: "sent_to_investigation" }
            : item
        ),
      }));

      setSuccess("Crime post sent to Case Management.");
      navigate(caseId ? `/cases?case=${caseId}` : "/cases");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to send post to Case Management"
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
          onClick={() => navigate("/blacklist")}
          className="mb-6 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-slate-200"
        >
          <ArrowLeft size={16} />
          Back to Facebook Pages
        </button>

        <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-cyan-400">
              Facebook → Reports → Notifications → Case
            </p>
            <h1 className="mt-1 text-3xl font-bold">
              {data.item?.name || "Facebook Posts"}
            </h1>
            <p className="mt-2 break-all text-cyan-300">{data.item?.value}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/cases")}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400"
            >
              <Bell size={16} />
              Case Management
            </button>
            <button
              type="button"
              onClick={() => navigate("/reports")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-slate-700"
            >
              <ClipboardList size={16} />
              Reports
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
            {success}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-400">
              Published
            </label>
            <select
              value={selectedPeriod}
              onChange={(event) => setSelectedPeriod(event.target.value)}
              aria-label="Filter posts by publication period"
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            >
              {PERIODS.map((period) => (
                <option key={period.value} value={period.value}>{period.label}</option>
              ))}
            </select>
          </div>
          {selectedPeriod && (
            <button
              type="button"
              onClick={() => setSelectedPeriod("")}
              className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-bold text-slate-300 hover:bg-slate-800"
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="my-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card title="Total Posts" value={data.summary?.totalPosts || 0} />
          <Card title="Crime Posts" value={data.summary?.crimePosts || 0} />
          <Card title="Not Crime" value={data.summary?.safePosts || 0} />
        </div>

        {loading ? (
          <p className="text-slate-400">Loading scanned posts...</p>
        ) : (data.posts || []).length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
            <ShieldAlert className="mx-auto mb-3 text-slate-500" size={36} />
            <p className="font-bold">
              {selectedPeriod
                ? `No posts found in the last ${selectedPeriod}`
                : "No posts scanned yet"}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {selectedPeriod
                ? "Try a wider publication range or scan this Facebook page again."
                : "Scan this Facebook page from Blacklist, then crime posts appear in Notifications."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {(data.posts || []).map((post) => {
              const alreadySent =
                post.investigationStatus === "sent_to_investigation" ||
                post.investigationStatus === "under_review" ||
                post.investigationStatus === "crime_case" ||
                post.investigationStatus === "not_crime";

              return (
                <div
                  key={post._id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <ShieldAlert
                      size={17}
                      className={post.isCrime ? "text-red-400" : "text-emerald-400"}
                    />
                    <Badge color={post.isCrime ? "red" : "green"}>
                      {post.isCrime ? "CRIME" : "NOT CRIME"}
                    </Badge>
                    <Badge color="cyan">
                      {post.label || post.prediction || "No label"}
                    </Badge>
                    <Badge color="cyan">{post.confidence || 0}%</Badge>
                    {alreadySent && (
                      <Badge color="cyan">Sent to Case</Badge>
                    )}
                    <span className="text-xs text-slate-500">
                      {new Date(post.publishedAt || post.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">
                    {post.isCrime
                      ? renderCrimeHighlightedText(post.content, true, {
                          matchedKeyword: post.matchedKeyword,
                          blacklistMatches: post.blacklistMatches,
                        })
                      : post.content}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {post.url && (
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-bold text-cyan-300 hover:bg-slate-700"
                      >
                        Open original post
                      </a>
                    )}

                    {canSendToCase && post.isCrime && !alreadySent && (
                      <button
                        type="button"
                        disabled={sendingId === post._id}
                        onClick={() => sendToCase(post)}
                        className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-60"
                      >
                        {sendingId === post._id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Send size={14} />
                        )}
                        Send to Case
                      </button>
                    )}

                    {canSendToCase && post.isCrime && alreadySent && (
                      <button
                        type="button"
                        onClick={() => navigate("/cases")}
                        className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm font-bold text-cyan-300"
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

function Card({ title, value }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{title}</p>
      <h2 className="mt-2 text-3xl font-bold">{value}</h2>
    </div>
  );
}

function Badge({ children, color }) {
  const classes = {
    red: "bg-red-500/10 text-red-300 border-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  };

  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs ${classes[color]}`}>
      {children}
    </span>
  );
}
