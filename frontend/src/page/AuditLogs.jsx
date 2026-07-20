import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Filter,
  Globe,
  RefreshCw,
  Search,
  Shield,
  XCircle,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import API from "../api";
import { getStoredUser } from "../theme";

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function RoleBadge({ role }) {
  const styles = {
    admin: { bg: "rgba(139, 92, 246, 0.12)", color: "#a78bfa", border: "rgba(139, 92, 246, 0.3)" },
    investigator: { bg: "rgba(59, 130, 246, 0.12)", color: "#60a5fa", border: "rgba(59, 130, 246, 0.3)" },
    user: { bg: "rgba(100, 116, 139, 0.12)", color: "#94a3b8", border: "rgba(100, 116, 139, 0.3)" },
  };
  const s = styles[role] || styles.user;
  return (
    <span
      className="inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: s.bg, color: s.color, borderColor: s.border }}
    >
      {role || "—"}
    </span>
  );
}

function StatusBadge({ status }) {
  const ok = status !== "failed";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{
        backgroundColor: ok ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
        color: ok ? "#22c55e" : "#ef4444",
        borderColor: ok ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)",
      }}
    >
      {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {ok ? "Success" : "Failed"}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border-base)",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: accent.soft, color: accent.color }}
        >
          <Icon size={18} />
        </span>
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{ color: "var(--text-muted)" }}
          >
            {label}
          </p>
          <p className="mt-0.5 text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

const emptyFilters = {
  search: "",
  module: "",
  action: "",
  status: "",
  from: "",
  to: "",
};

export default function AuditLogs() {
  const storedUser = getStoredUser();
  const isAdmin = storedUser?.role === "admin";

  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ modules: [], actions: [], access: {} });
  const [stats, setStats] = useState({ total: 0, failed: 0, last7Days: 0, byModule: [] });
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  const loadMetaAndStats = useCallback(async () => {
    try {
      const [metaRes, statsRes] = await Promise.all([
        API.get("/audit-logs/meta"),
        API.get("/audit-logs/stats"),
      ]);
      setMeta(metaRes.data || { modules: [], actions: [], access: {} });
      setStats(statsRes.data || { total: 0, failed: 0, last7Days: 0, byModule: [] });
    } catch (err) {
      console.error("Audit meta/stats error:", err);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        limit: 25,
      };
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.module) params.module = filters.module;
      if (filters.action) params.action = filters.action;
      if (filters.status) params.status = filters.status;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;

      const res = await API.get("/audit-logs", { params });
      setItems(res.data?.items || []);
      setPagination(res.data?.pagination || { page: 1, limit: 25, total: 0, pages: 1 });
    } catch (err) {
      setItems([]);
      setError(err.response?.data?.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    loadMetaAndStats();
  }, [loadMetaAndStats]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setPage(1);
    setFilters(emptyFilters);
  };

  const refresh = () => {
    loadMetaAndStats();
    loadLogs();
  };

  const buildFilterParams = (limit = 25, pageNum = 1) => {
    const params = { page: pageNum, limit };
    if (filters.search.trim()) params.search = filters.search.trim();
    if (filters.module) params.module = filters.module;
    if (filters.action) params.action = filters.action;
    if (filters.status) params.status = filters.status;
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    return params;
  };

  const fetchExportRows = async () => {
    const res = await API.get("/audit-logs", {
      params: buildFilterParams(1000, 1),
    });
    return res.data?.items || [];
  };

  const downloadCsv = async () => {
    try {
      setDownloading(true);
      setError("");
      const rows = await fetchExportRows();
      if (!rows.length) {
        setError("No audit logs to download for the current filters.");
        return;
      }

      const headers = [
        "Date & Time",
        "User",
        "Email",
        "Role",
        "Action",
        "Module",
        "Description",
        "Status",
      ];
      const csvRows = rows.map((log) => [
        formatDateTime(log.createdAt),
        log.user?.name || log.userName || "Unknown",
        log.user?.email || "",
        log.role || log.user?.role || "",
        log.actionLabel || log.action || "",
        log.module || "",
        log.description || "",
        log.status || "success",
      ]);

      const escapeCell = (value) => {
        const text = String(value ?? "");
        if (/[",\n\r]/.test(text)) {
          return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
      };

      const csv = [headers, ...csvRows]
        .map((row) => row.map(escapeCell).join(","))
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `BAREAI-audit-logs-${stamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      try {
        await API.post("/audit-logs/events", {
          action: "report_exported",
          details: { reportType: "audit-logs", format: "csv", count: rows.length },
        });
      } catch {
        // non-blocking
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to download CSV");
    } finally {
      setDownloading(false);
    }
  };

  const downloadPdf = async () => {
    try {
      setDownloading(true);
      setError("");
      const rows = await fetchExportRows();
      if (!rows.length) {
        setError("No audit logs to download for the current filters.");
        return;
      }

      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      doc.setFontSize(16);
      doc.setTextColor(30, 58, 138);
      doc.text("BAREAI — Audit Logs", 40, 36);
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Exported ${formatDateTime(new Date())} · ${rows.length} entries`, 40, 54);

      autoTable(doc, {
        startY: 68,
        head: [["Date", "User", "Role", "Action", "Module", "Description", "Status"]],
        body: rows.map((log) => [
          formatDateTime(log.createdAt),
          log.user?.name || log.userName || "Unknown",
          log.role || log.user?.role || "—",
          log.actionLabel || log.action || "—",
          log.module || "—",
          log.description || "—",
          log.status || "success",
        ]),
        styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          5: { cellWidth: 180 },
        },
        margin: { left: 40, right: 40 },
      });

      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`BAREAI-audit-logs-${stamp}.pdf`);

      try {
        await API.post("/audit-logs/events", {
          action: "report_exported",
          details: { reportType: "audit-logs", format: "pdf", count: rows.length },
        });
      } catch {
        // non-blocking
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to download PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-w-0 max-w-full space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: "var(--brand-soft)", color: "var(--brand)" }}
            >
              <Shield size={20} />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
                Audit Logs
              </h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {isAdmin
                  ? "Full system activity trail — who did what, when, and from where."
                  : "Your own activity trail within the system."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadCsv}
            disabled={downloading || loading}
            className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-base)",
              color: "var(--text-primary)",
            }}
          >
            <Download size={16} />
            {downloading ? "Downloading…" : "Download CSV"}
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={downloading || loading}
            className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--navy)" }}
          >
            <FileText size={16} />
            Download PDF
          </button>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition hover:opacity-90"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-base)",
              color: "var(--text-primary)",
            }}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={Activity}
          label="Total events"
          value={stats.total}
          accent={{ soft: "rgba(59, 130, 246, 0.12)", color: "#60a5fa" }}
        />
        <StatCard
          icon={Clock3}
          label="Last 7 days"
          value={stats.last7Days}
          accent={{ soft: "rgba(245, 158, 11, 0.12)", color: "#fbbf24" }}
        />
        <StatCard
          icon={XCircle}
          label="Failed events"
          value={stats.failed}
          accent={{ soft: "rgba(239, 68, 68, 0.12)", color: "#f87171" }}
        />
      </div>

      <div
        className="min-w-0 overflow-hidden rounded-2xl border p-4"
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-base)" }}
      >
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
          <Filter size={16} />
          Filters
        </div>

        <div className="space-y-3">
          <label className="relative block min-w-0">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              placeholder="Search user, action…"
              className="w-full min-w-0 rounded-xl border py-2.5 pl-9 pr-3 text-sm outline-none"
              style={{
                backgroundColor: "var(--bg-base)",
                borderColor: "var(--border-base)",
                color: "var(--text-primary)",
              }}
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <select
              value={filters.module}
              onChange={(e) => updateFilter("module", e.target.value)}
              className="w-full min-w-0 rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{
                backgroundColor: "var(--bg-base)",
                borderColor: "var(--border-base)",
                color: "var(--text-primary)",
              }}
              title={filters.module || "All modules"}
            >
              <option value="">All modules</option>
              {(meta.modules || []).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={filters.action}
              onChange={(e) => updateFilter("action", e.target.value)}
              className="w-full min-w-0 rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{
                backgroundColor: "var(--bg-base)",
                borderColor: "var(--border-base)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">All actions</option>
              {(meta.actions || []).map((a) => (
                <option key={a} value={a}>
                  {a.replace(/[_.-]+/g, " ")}
                </option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="w-full min-w-0 rounded-xl border px-3 py-2.5 text-sm outline-none sm:col-span-2 lg:col-span-1"
              style={{
                backgroundColor: "var(--bg-base)",
                borderColor: "var(--border-base)",
                color: "var(--text-primary)",
              }}
            >
              <option value="">All statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-xl">
            <label className="block min-w-0">
              <span
                className="mb-1 block text-[11px] font-bold uppercase tracking-[0.06em]"
                style={{ color: "var(--text-muted)" }}
              >
                From
              </span>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => updateFilter("from", e.target.value)}
                className="w-full min-w-0 rounded-xl border px-3 py-2.5 text-sm outline-none"
                style={{
                  backgroundColor: "var(--bg-base)",
                  borderColor: "var(--border-base)",
                  color: "var(--text-primary)",
                }}
              />
            </label>
            <label className="block min-w-0">
              <span
                className="mb-1 block text-[11px] font-bold uppercase tracking-[0.06em]"
                style={{ color: "var(--text-muted)" }}
              >
                To
              </span>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => updateFilter("to", e.target.value)}
                className="w-full min-w-0 rounded-xl border px-3 py-2.5 text-sm outline-none"
                style={{
                  backgroundColor: "var(--bg-base)",
                  borderColor: "var(--border-base)",
                  color: "var(--text-primary)",
                }}
              />
            </label>
          </div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-semibold underline-offset-2 hover:underline"
            style={{ color: "var(--text-muted)" }}
          >
            Clear filters
          </button>
        </div>
      </div>

      <div
        className="overflow-hidden rounded-2xl border"
        style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-base)" }}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-base)" }}>
                {["Date & Time", "User", "Role", "Action", "Module", "Description", "Status"].map(
                  (h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    Loading audit logs…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm font-semibold text-red-500">
                    {error}
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                    No audit log entries match your filters.
                  </td>
                </tr>
              ) : (
                items.map((log) => (
                  <tr
                    key={log.id || log._id}
                    onClick={() => setSelected(log)}
                    className="cursor-pointer transition hover:opacity-95"
                    style={{ borderBottom: "1px solid var(--border-base)" }}
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium" style={{ color: "var(--text-primary)" }}>
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: "var(--text-primary)" }}>
                        {log.user?.name || "Unknown"}
                      </div>
                      {log.user?.email && (
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                          {log.user.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={log.role || log.user?.role} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold" style={{ color: "var(--text-primary)" }}>
                      {log.actionLabel || log.action}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                      {log.module || "—"}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-3" style={{ color: "var(--text-secondary)" }} title={log.description}>
                      {log.description || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={log.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div
          className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3"
          style={{ borderColor: "var(--border-base)" }}
        >
          <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
            Showing page {pagination.page} of {pagination.pages} · {pagination.total} events
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"
              style={{
                backgroundColor: "var(--bg-base)",
                borderColor: "var(--border-base)",
                color: "var(--text-primary)",
              }}
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <button
              type="button"
              disabled={page >= pagination.pages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40"
              style={{
                backgroundColor: "var(--bg-base)",
                borderColor: "var(--border-base)",
                color: "var(--text-primary)",
              }}
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border p-5 shadow-xl"
            style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-base)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.1em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Audit Log Entry
                </p>
                <h2 className="mt-1 text-lg font-extrabold" style={{ color: "var(--text-primary)" }}>
                  {formatDateTime(selected.createdAt)}
                </h2>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            <dl className="space-y-3 text-sm">
              {[
                ["User", selected.user?.name || "Unknown"],
                ["Role", selected.role || selected.user?.role || "—"],
                ["Action", selected.actionLabel || selected.action],
                ["Module", selected.module || "—"],
                ["Description", selected.description || "—"],
                ["Device", selected.userAgent || "—"],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[110px_1fr] gap-2">
                  <dt className="font-bold" style={{ color: "var(--text-muted)" }}>
                    {label}
                  </dt>
                  <dd className="break-words font-medium" style={{ color: "var(--text-primary)" }}>
                    {label === "Role" ? <RoleBadge role={value} /> : value}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl border px-4 py-2 text-sm font-semibold"
                style={{
                  backgroundColor: "var(--bg-base)",
                  borderColor: "var(--border-base)",
                  color: "var(--text-primary)",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {stats.byModule?.length > 0 && (
        <div
          className="rounded-2xl border p-4"
          style={{ backgroundColor: "var(--bg-surface)", borderColor: "var(--border-base)" }}
        >
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            <Globe size={16} />
            Events by module
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.byModule.map((row) => (
              <span
                key={row.module}
                className="rounded-xl border px-3 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: "var(--bg-base)",
                  borderColor: "var(--border-base)",
                  color: "var(--text-primary)",
                }}
              >
                {row.module}: {row.count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
