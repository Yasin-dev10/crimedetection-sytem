import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  ExternalLink,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldX,
  UserRound,
} from "lucide-react";
import API from "../api";

const THRESHOLD = 3;

export default function FakeCrimes() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    threshold: THRESHOLD,
    summary: { subjects: 0, totalConfirmedFakeReports: 0 },
    subjects: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
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

  useEffect(() => {
    loadFakeCrimes();
  }, []);

  const typeOptions = useMemo(() => {
    const types = new Set(
      (data.subjects || [])
        .map((row) => row.item?.type)
        .filter(Boolean)
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

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const threshold = data.threshold ?? THRESHOLD;

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
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Fake Crimes</h1>
            <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>
              Only investigator-confirmed false crime reports count. Subjects appear
              here after at least {threshold} distinct confirmed not-crime cases.
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
              onClick={loadFakeCrimes}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "var(--navy)" }}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              {loading ? "Refreshing..." : "Refresh"}
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
              htmlFor="fake-crimes-search"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--text-muted)" }}
            >
              Search subjects
            </label>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                id="fake-crimes-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by name, value, or type..."
                className="w-full rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none"
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border-base)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
          </div>

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
        </div>

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
              style={{ background: "var(--brand-soft)", color: "var(--brand)" }}
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
                const isExpanded = expandedIds.has(itemId);
                return (
                  <SubjectCard
                    key={itemId || row.item?.value}
                    row={row}
                    threshold={threshold}
                    expanded={isExpanded}
                    onToggle={() => toggleExpanded(itemId)}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
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
            <h3 className="text-base font-bold sm:text-lg">{item.name || "Unknown"}</h3>
            <Badge color="cyan">{formatType(item.type)}</Badge>
            <Badge color={item.active ? "green" : "gray"}>
              {item.active ? "Active" : "Paused"}
            </Badge>
            {item.priority && (
              <Badge color="gray">Priority: {item.priority}</Badge>
            )}
            <Badge color="red">≥ {threshold} threshold</Badge>
          </div>

          <p
            className="mt-2 break-all text-sm font-medium"
            style={{ color: "var(--brand)" }}
          >
            {item.value || "—"}
          </p>
          {item.reason && (
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {item.reason}
            </p>
          )}
          <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
            Latest fake report: {formatDate(row.latestOccurrenceAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-center">
            <p
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--accent-danger)" }}
            >
              Fake count
            </p>
            <p
              className="mt-0.5 text-3xl font-bold"
              style={{ color: "var(--accent-danger)" }}
            >
              {row.fakeCount ?? 0}
            </p>
          </div>

          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={panelId}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-opacity hover:opacity-85"
            style={{
              background: "var(--navy)",
              color: "var(--on-accent)",
              border: "1px solid var(--navy)",
            }}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {expanded ? "Hide evidence" : `Evidence (${evidence.length})`}
          </button>
        </div>
      </div>

      {expanded && (
        <div
          id={panelId}
          className="mt-4 space-y-3 border-t pt-4"
          style={{ borderColor: "var(--border-muted)" }}
        >
          {evidence.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              No evidence records returned for this subject.
            </p>
          ) : (
            evidence.map((entry, index) => (
              <EvidenceCard
                key={`${entry.caseId || "case"}-${entry.historyId || index}`}
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
    (resolver.badgeNumber ? `Badge ${resolver.badgeNumber}` : "Unknown investigator");

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
        <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
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
          {resolver.badgeNumber && resolver.name
            ? ` (Badge ${resolver.badgeNumber})`
            : ""}
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
        <Link
          to="/reports"
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-opacity hover:opacity-85"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border-base)",
          }}
        >
          <ClipboardList size={13} />
          Reports
        </Link>
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
    brand: { bg: "var(--brand-soft)", border: "var(--brand-ring)", icon: "var(--brand)" },
    navy: { bg: "var(--brand-soft)", border: "var(--brand-ring)", icon: "var(--brand)" },
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
        <Icon size={20} style={{ color: tone.icon, opacity: 0.7 }} className="shrink-0" />
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
      <ShieldX className="mx-auto mb-3" size={40} style={{ color: "var(--text-muted)" }} />
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
