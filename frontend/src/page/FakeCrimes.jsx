import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ExternalLink,
  Flag,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldX,
  UserRound,
} from "lucide-react";
import API from "../api";

const THRESHOLD = 3;

const FLAG_TYPE_LABELS = {
  false_report: "False Report",
  misleading_information: "Misleading Information",
  malicious_report: "Malicious Report",
};

export default function FakeCrimes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab =
    searchParams.get("tab") === "flags" ? "flags" : "subjects";

  const [tab, setTab] = useState(initialTab);
  const [data, setData] = useState({
    threshold: THRESHOLD,
    summary: { subjects: 0, totalConfirmedFakeReports: 0 },
    subjects: [],
  });
  const [flagsData, setFlagsData] = useState({
    summary: {
      total: 0,
      pending: 0,
      confirmed: 0,
      rejected: 0,
      false_report: 0,
      misleading_information: 0,
      malicious_report: 0,
    },
    flags: [],
  });
  const [loading, setLoading] = useState(true);
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [flagReviewFilter, setFlagReviewFilter] = useState("all");
  const [flagTypeFilter, setFlagTypeFilter] = useState("all");
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const loadFakeCrimes = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get("/blacklist/fake-crimes", {
        params: { threshold: THRESHOLD },
      });
      setData({
        threshold: res.data?.threshold ?? THRESHOLD,
        summary: res.data?.summary || {
          subjects: 0,
          totalConfirmedFakeReports: 0,
        },
        subjects: res.data?.subjects || [],
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to load fake crime subjects"
      );
      setData({
        threshold: THRESHOLD,
        summary: { subjects: 0, totalConfirmedFakeReports: 0 },
        subjects: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const loadReportFlags = async () => {
    try {
      setFlagsLoading(true);
      const res = await API.get("/blacklist/report-flags");
      setFlagsData({
        summary: res.data?.summary || {
          total: 0,
          pending: 0,
          confirmed: 0,
          rejected: 0,
          false_report: 0,
          misleading_information: 0,
          malicious_report: 0,
        },
        flags: res.data?.flags || [],
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to load report flags"
      );
      setFlagsData({
        summary: {
          total: 0,
          pending: 0,
          confirmed: 0,
          rejected: 0,
          false_report: 0,
          misleading_information: 0,
          malicious_report: 0,
        },
        flags: [],
      });
    } finally {
      setFlagsLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadFakeCrimes(), loadReportFlags()]);
  };

  useEffect(() => {
    refreshAll();
  }, []);

  const changeTab = (next) => {
    setTab(next);
    setSearchParams(next === "flags" ? { tab: "flags" } : {});
  };

  const typeOptions = useMemo(() => {
    const types = new Set(
      (data.subjects || []).map((row) => row.item?.type).filter(Boolean)
    );
    return Array.from(types).sort();
  }, [data.subjects]);

  const filteredSubjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data.subjects || []).filter((row) => {
      const item = row.item || {};
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (!query) return true;
      const haystack = [item.name, item.value, item.type, item.reason]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [data.subjects, search, typeFilter]);

  const filteredFlags = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (flagsData.flags || []).filter((item) => {
      const flag = item.reportFlag || {};
      if (flagReviewFilter !== "all" && flag.reviewStatus !== flagReviewFilter) {
        return false;
      }
      if (flagTypeFilter !== "all" && flag.type !== flagTypeFilter) {
        return false;
      }
      if (!query) return true;
      const reporter =
        flag.reportingUser || item.history?.user || {};
      const haystack = [
        flag.type,
        flag.reason,
        flag.reviewStatus,
        reporter.name,
        reporter.email,
        flag.flaggedBy?.name,
        item.history?.content,
        item.history?.pageName,
        item.history?.authorName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [flagsData.flags, search, flagReviewFilter, flagTypeFilter]);

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const threshold = data.threshold ?? THRESHOLD;
  const isBusy = loading || flagsLoading;

  return (
    <div
      className="w-full transition-colors duration-300"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--brand)" }}
            >
              Watchlist Control
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Fake Crimes & Report Flags
            </h1>
            <p
              className="mt-2 max-w-2xl text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              View repeat fake-crime blacklist subjects and investigator flags
              (false / misleading / malicious reports).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/blacklist")}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border-base)",
              }}
            >
              <ArrowLeft size={16} />
              Back to Blacklist
            </button>
            <button
              type="button"
              onClick={refreshAll}
              disabled={isBusy}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "var(--navy)" }}
            >
              <RefreshCw size={16} className={isBusy ? "animate-spin" : ""} />
              {isBusy ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <div
            className="mb-5 rounded-xl px-4 py-3 text-sm"
            role="alert"
            style={{
              background: "var(--accent-danger-soft)",
              border: "1px solid var(--accent-danger-border)",
              color: "var(--accent-danger)",
            }}
          >
            {error}
          </div>
        )}

        <div
          className="mb-5 flex flex-wrap gap-2 rounded-2xl p-2"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-base)",
          }}
        >
          <TabButton
            active={tab === "subjects"}
            onClick={() => changeTab("subjects")}
            icon={ShieldX}
            label="Repeat Subjects"
            count={data.summary?.subjects ?? 0}
          />
          <TabButton
            active={tab === "flags"}
            onClick={() => changeTab("flags")}
            icon={Flag}
            label="False Report Flags"
            count={flagsData.summary?.total ?? 0}
            accent={flagsData.summary?.pending > 0}
          />
        </div>

        {tab === "subjects" ? (
          <>
            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SummaryCard
                title="Repeat Subjects"
                value={data.summary?.subjects ?? 0}
                icon={ShieldX}
                color="red"
              />
              <SummaryCard
                title="Confirmed Fake Reports"
                value={data.summary?.totalConfirmedFakeReports ?? 0}
                icon={ShieldAlert}
                color="navy"
              />
              <SummaryCard
                title="Automatic Threshold"
                value={threshold}
                icon={ClipboardList}
                color="brand"
              />
            </div>

            <FilterBar
              search={search}
              setSearch={setSearch}
              searchId="fake-crimes-search"
              searchLabel="Search subjects"
              searchPlaceholder="Filter by name, value, or type..."
            >
              <div className="w-full sm:w-52">
                <label
                  htmlFor="fake-crimes-type"
                  className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}
                >
                  Type
                </label>
                <select
                  id="fake-crimes-type"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-base)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="all">All types</option>
                  {typeOptions.map((type) => (
                    <option key={type} value={type}>
                      {formatType(type)}
                    </option>
                  ))}
                </select>
              </div>
            </FilterBar>

            <section
              className="rounded-2xl p-5 sm:p-6"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-base)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg">
                  <ShieldX size={18} style={{ color: "var(--brand)" }} />
                  Subjects at or above threshold
                </h2>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    background: "var(--brand-soft)",
                    color: "var(--brand)",
                  }}
                >
                  {filteredSubjects.length} shown
                </span>
              </div>

              {loading ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Loading fake crime subjects...
                </p>
              ) : filteredSubjects.length === 0 ? (
                <Empty
                  text={
                    (data.subjects || []).length === 0
                      ? `No subjects with ${threshold}+ investigator-confirmed fake crime reports yet.`
                      : "No subjects match your search or type filter."
                  }
                />
              ) : (
                <div className="space-y-3">
                  {filteredSubjects.map((row) => {
                    const itemId = String(row.item?._id || "");
                    return (
                      <SubjectCard
                        key={itemId || row.item?.value}
                        row={row}
                        threshold={threshold}
                        expanded={expandedIds.has(itemId)}
                        onToggle={() => toggleExpanded(itemId)}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryCard
                title="All Flags"
                value={flagsData.summary?.total ?? 0}
                icon={Flag}
                color="navy"
              />
              <SummaryCard
                title="Pending Review"
                value={flagsData.summary?.pending ?? 0}
                icon={ShieldAlert}
                color="red"
              />
              <SummaryCard
                title="Confirmed"
                value={flagsData.summary?.confirmed ?? 0}
                icon={ShieldX}
                color="brand"
              />
              <SummaryCard
                title="Malicious"
                value={flagsData.summary?.malicious_report ?? 0}
                icon={Flag}
                color="red"
              />
            </div>

            <FilterBar
              search={search}
              setSearch={setSearch}
              searchId="report-flags-search"
              searchLabel="Search flags"
              searchPlaceholder="Filter by reporter, reason, or content..."
            >
              <div className="w-full sm:w-44">
                <label
                  htmlFor="flag-review-filter"
                  className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}
                >
                  Review
                </label>
                <select
                  id="flag-review-filter"
                  value={flagReviewFilter}
                  onChange={(e) => setFlagReviewFilter(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-base)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div className="w-full sm:w-52">
                <label
                  htmlFor="flag-type-filter"
                  className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}
                >
                  Flag type
                </label>
                <select
                  id="flag-type-filter"
                  value={flagTypeFilter}
                  onChange={(e) => setFlagTypeFilter(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-base)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="all">All types</option>
                  <option value="false_report">False Report</option>
                  <option value="misleading_information">
                    Misleading Information
                  </option>
                  <option value="malicious_report">Malicious Report</option>
                </select>
              </div>
            </FilterBar>

            <section
              className="rounded-2xl p-5 sm:p-6"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-base)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-bold sm:text-lg">
                  <Flag size={18} style={{ color: "var(--brand)" }} />
                  Investigator report flags
                </h2>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    background: "var(--brand-soft)",
                    color: "var(--brand)",
                  }}
                >
                  {filteredFlags.length} shown
                </span>
              </div>

              <p
                className="mb-4 text-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Flags set in Case Management. Pending flags need admin confirm
                before warning, suspension, or block.
              </p>

              {flagsLoading ? (
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Loading report flags...
                </p>
              ) : filteredFlags.length === 0 ? (
                <Empty
                  text={
                    (flagsData.flags || []).length === 0
                      ? "No false / malicious report flags yet. Investigators mark them from Case Management."
                      : "No flags match your filters."
                  }
                />
              ) : (
                <div className="space-y-3">
                  {filteredFlags.map((item) => (
                    <FlagCard key={item._id} item={item} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count, accent }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-opacity"
      style={
        active
          ? {
              background: "var(--navy)",
              color: "white",
              border: "1px solid var(--navy)",
            }
          : {
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid transparent",
            }
      }
    >
      <Icon size={16} />
      {label}
      <span
        className="rounded-full px-2 py-0.5 text-[11px] font-bold"
        style={
          active
            ? { background: "rgba(255,255,255,0.2)", color: "white" }
            : accent
            ? {
                background: "var(--accent-danger-soft)",
                color: "var(--accent-danger)",
              }
            : {
                background: "var(--bg-elevated)",
                color: "var(--text-muted)",
              }
        }
      >
        {count}
      </span>
    </button>
  );
}

function FilterBar({
  search,
  setSearch,
  searchId,
  searchLabel,
  searchPlaceholder,
  children,
}) {
  return (
    <div
      className="mb-5 flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-end sm:p-5"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-base)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="min-w-0 flex-1">
        <label
          htmlFor={searchId}
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-muted)" }}
        >
          {searchLabel}
        </label>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }}
          />
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-base)",
              color: "var(--text-primary)",
            }}
          />
        </div>
      </div>
      {children}
    </div>
  );
}

function FlagCard({ item }) {
  const flag = item.reportFlag || {};
  const history = item.history || {};
  const reporter = flag.reportingUser || history.user || null;
  const typeLabel = FLAG_TYPE_LABELS[flag.type] || formatType(flag.type);
  const review = flag.reviewStatus || "pending";

  return (
    <article
      className="rounded-xl p-4 sm:p-5"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-muted)",
      }}
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color="red">{typeLabel}</Badge>
            <Badge
              color={
                review === "confirmed"
                  ? "green"
                  : review === "rejected"
                  ? "gray"
                  : "cyan"
              }
            >
              {formatType(review)}
            </Badge>
            {flag.adminAction && flag.adminAction !== "none" && (
              <Badge color="gray">Sanction: {formatType(flag.adminAction)}</Badge>
            )}
          </div>

          <p
            className="mt-3 line-clamp-3 text-sm leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {flag.reason || "No reason provided."}
          </p>

          <div
            className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs"
            style={{ color: "var(--text-muted)" }}
          >
            {reporter ? (
              <span className="inline-flex items-center gap-1">
                <UserRound size={12} />
                Reporter: {reporter.name || reporter.email || "Unknown"}
                {typeof reporter.false_report_count === "number"
                  ? ` · Flags: ${reporter.false_report_count}`
                  : ""}
                {reporter.account_status
                  ? ` · ${formatType(reporter.account_status)}`
                  : ""}
              </span>
            ) : (
              <span>No linked citizen account (scan / external source)</span>
            )}
            {flag.flaggedBy?.name && (
              <span>Flagged by {flag.flaggedBy.name}</span>
            )}
            <span>{formatDate(flag.flaggedAt)}</span>
          </div>

          {(history.pageName || history.authorName || history.sourceType) && (
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              Source:{" "}
              {[history.sourceType, history.pageName, history.authorName]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 lg:shrink-0">
          {item._id && (
            <Link
              to={`/cases?case=${item._id}`}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-opacity hover:opacity-85"
              style={{
                background: "var(--navy)",
                color: "var(--on-accent)",
              }}
            >
              Open Case
            </Link>
          )}
          {history.url && (
            <a
              href={history.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-opacity hover:opacity-85"
              style={{
                background: "var(--brand)",
                color: "var(--on-accent)",
              }}
            >
              <ExternalLink size={13} />
              URL
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function SubjectCard({ row, threshold, expanded, onToggle }) {
  const item = row.item || {};
  const evidence = row.evidence || [];
  const panelId = `fake-evidence-${item._id || "unknown"}`;

  return (
    <article
      className="rounded-xl p-4 sm:p-5"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-muted)",
      }}
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold sm:text-lg">
              {item.name || "Unknown"}
            </h3>
            <Badge color="cyan">{formatType(item.type)}</Badge>
            <Badge color={item.active ? "green" : "gray"}>
              {item.active ? "Active" : "Paused"}
            </Badge>
            {item.priority && (
              <Badge color="gray">Priority: {item.priority}</Badge>
            )}
          </div>

          <p
            className="mt-2 break-all text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            {item.value || "—"}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <span style={{ color: "var(--accent-danger)" }} className="font-bold">
              {row.fakeCount || 0} confirmed fake
            </span>
            <span style={{ color: "var(--text-muted)" }}>
              Threshold: {threshold}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-opacity hover:opacity-85"
            style={{
              background: "var(--bg-elevated)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-base)",
            }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Evidence ({evidence.length})
          </button>
        </div>
      </div>

      {expanded && (
        <div id={panelId} className="mt-4 space-y-3 border-t pt-4" style={{ borderColor: "var(--border-soft)" }}>
          {evidence.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No evidence entries.
            </p>
          ) : (
            evidence.map((entry, idx) => (
              <EvidenceCard
                key={entry.caseId || entry.historyId || idx}
                entry={entry}
              />
            ))
          )}
        </div>
      )}
    </article>
  );
}

function EvidenceCard({ entry }) {
  const resolver = entry.resolvedBy || {};
  const resolverLabel =
    resolver.name ||
    resolver.email ||
    (resolver.badgeNumber
      ? `Badge ${resolver.badgeNumber}`
      : "Unknown investigator");

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-soft)",
      }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {entry.sourceType && (
          <Badge color="cyan">{formatType(entry.sourceType)}</Badge>
        )}
        <span
          className="ml-auto text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          Resolved {formatDate(entry.resolvedAt)}
        </span>
      </div>

      <p
        className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {entry.content || "No content snippet available."}
      </p>

      <div
        className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        {(entry.authorName || entry.pageName) && (
          <span className="inline-flex items-center gap-1">
            <UserRound size={12} />
            {[entry.authorName, entry.pageName].filter(Boolean).join(" · ")}
          </span>
        )}
        <span>
          Marked fake by{" "}
          <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>
            {resolverLabel}
          </strong>
        </span>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-2">
        {entry.caseId && (
          <Link
            to={`/cases?case=${entry.caseId}`}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-opacity hover:opacity-85"
            style={{
              background: "var(--navy)",
              color: "var(--on-accent)",
            }}
          >
            Open Case
          </Link>
        )}
        {entry.url && (
          <a
            href={entry.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-opacity hover:opacity-85"
            style={{
              background: "var(--brand)",
              color: "var(--on-accent)",
            }}
          >
            <ExternalLink size={13} />
            External URL
          </a>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, icon: Icon, color }) {
  const tones = {
    brand: {
      bg: "var(--brand-soft)",
      border: "var(--brand-ring)",
      icon: "var(--brand)",
    },
    navy: {
      bg: "var(--brand-soft)",
      border: "var(--brand-ring)",
      icon: "var(--brand)",
    },
    red: {
      bg: "var(--accent-danger-soft)",
      border: "var(--accent-danger-border)",
      icon: "var(--accent-danger)",
    },
  };
  const tone = tones[color] || tones.brand;

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: tone.bg, border: `1px solid ${tone.border}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            {title}
          </p>
          <p className="mt-1.5 text-2xl font-bold sm:text-3xl">{value}</p>
        </div>
        <Icon
          size={20}
          style={{ color: tone.icon, opacity: 0.7 }}
          className="shrink-0"
        />
      </div>
    </div>
  );
}

function Badge({ children, color }) {
  const classes = {
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
  const tone = classes[color] || classes.gray;

  return (
    <span
      className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
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

function Empty({ text }) {
  return (
    <div className="py-12 text-center">
      <ShieldX
        className="mx-auto mb-3"
        size={40}
        style={{ color: "var(--text-muted)" }}
      />
      <p style={{ color: "var(--text-muted)" }}>{text}</p>
    </div>
  );
}

function formatType(value = "") {
  return String(value).replace(/_/g, " ");
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "N/A";
}
