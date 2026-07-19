import { useEffect, useState, useMemo } from "react";
import {
  BarChart2,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  Layers,
  Link as LinkIcon,
  Percent,
  RefreshCw,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { getMyHistory } from "../services";

export default function MyDashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const [data, setData]     = useState({ stats: { total: 0, crime: 0, notCrime: 0 }, records: [], totalPages: 1, page: 1 });
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL"); // ALL | CRIME | SAFE
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const fetchData = async (p = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getMyHistory(p, 20);
      setData(res);
      setPage(p);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(1); }, []);

  /* ── client-side search + filter ── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.records.filter((r) => {
      const matchSearch =
        !q ||
        r.content?.toLowerCase().includes(q) ||
        r.prediction?.toLowerCase().includes(q) ||
        r.type?.toLowerCase().includes(q);

      const matchFilter =
        filter === "ALL" ? true : filter === "CRIME" ? r.isCrime : !r.isCrime;

      return matchSearch && matchFilter;
    });
  }, [data.records, search, filter]);

  const crimeRate = data.stats.total
    ? Math.round((data.stats.crime / data.stats.total) * 100)
    : 0;

  return (
    <div className="min-h-screen p-6 md:p-10 font-sans" style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/60 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="icon-badge">
                <BarChart2 size={20} />
              </div>
              <div>
                <h1 className="page-title text-2xl">
                  My Dashboard
                </h1>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {user?.name || "User"} •{" "}
                  <span className="capitalize brand-text">{user?.role || "user"}</span>
                </p>
              </div>
            </div>
            <p className="text-slate-400 text-sm mt-2 ml-13">
              Your personal analysis data and results.
            </p>
          </div>

          <button
            onClick={() => fetchData(page)}
            disabled={loading}
            className="flex items-center gap-2 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-4 py-2 rounded-xl transition disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-300 rounded-2xl px-5 py-4 text-sm">
            <AlertCircle size={18} className="shrink-0" />
            {error}
          </div>
        )}

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <StatCard
            label="Total Analysis"
            value={loading ? "—" : data.stats.total}
            icon={<TrendingUp size={20} />}
            bgClass="bg-emerald-500/10"
            border="border-emerald-500/25"
            textColor="text-emerald-400"
          />
          <StatCard
            label="Crime Detected"
            value={loading ? "—" : data.stats.crime}
            icon={<ShieldAlert size={20} />}
            bgClass="bg-rose-500/10"
            border="border-rose-500/25"
            textColor="text-rose-400"
          />
          <StatCard
            label="Not Crime"
            value={loading ? "—" : data.stats.notCrime}
            icon={<ShieldCheck size={20} />}
            bgClass="bg-emerald-500/10"
            border="border-emerald-500/25"
            textColor="text-emerald-400"
          />
        </div>

        {/* ── Crime-rate bar ── */}
        {!loading && data.stats.total > 0 && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-slate-300">Crime Rate</span>
              <span className="text-sm font-bold text-rose-400">{crimeRate}%</span>
            </div>
            <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-rose-500 transition-all duration-700"
                style={{ width: `${crimeRate}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-500 mt-2">
              <span>0% Safe</span>
              <span>100% Crime</span>
            </div>
          </div>
        )}

        {/* ── Search + Filters ── */}
        <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
          <div className="flex items-center flex-1 bg-slate-950/80 px-4 py-2.5 rounded-xl border border-slate-800 focus-within:border-cyan-500/50 gap-2">
            <Search size={16} className="text-slate-500 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search content, prediction..."
              className="bg-transparent outline-none text-white text-sm w-full placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            {["ALL", "CRIME", "SAFE"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase transition ${
                  filter === f
                    ? "bg-emerald-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* ── Records List ── */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-slate-900/40 rounded-2xl animate-pulse border border-slate-800/40" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {filtered.map((record) => (
              <RecordCard key={record._id} record={record} />
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              onClick={() => fetchData(page - 1)}
              disabled={page <= 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="text-sm text-slate-400 font-medium">
              Page <span className="text-white font-bold">{page}</span> / {data.totalPages}
            </span>
            <button
              onClick={() => fetchData(page + 1)}
              disabled={page >= data.totalPages}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────── */

function StatCard({ label, value, icon, bgClass, border, textColor }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${border} p-5`} style={{ backgroundColor: "var(--bg-card)" }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 mb-1">{label}</p>
          <h2 className={`text-4xl font-extrabold ${textColor}`}>{value}</h2>
        </div>
        <div className={`p-2.5 rounded-xl bg-slate-800/60 ${textColor}`}>{icon}</div>
      </div>
    </div>
  );
}

function RecordCard({ record }) {
  const isCrime = record.isCrime;

  return (
    <div className="group card card-hover p-5">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {isCrime ? (
          <ShieldAlert size={17} className="text-rose-400 shrink-0" />
        ) : (
          <ShieldCheck size={17} className="text-emerald-400 shrink-0" />
        )}

        <span
          className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-md border ${
            isCrime
              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          }`}
        >
          {isCrime ? "CRIME" : "NOT CRIME"}
        </span>

        <TypeBadge type={record.type} />

        <div className="flex items-center gap-1 bg-slate-950/60 px-2 py-0.5 rounded-md border border-slate-800">
          <Percent size={10} className="text-slate-500" />
          <span className="text-[11px] font-bold text-slate-400">
            {record.confidence ?? 0}%
          </span>
        </div>

        <span className="ml-auto flex items-center gap-1 text-xs text-slate-500">
          <Calendar size={12} />
          {formatDate(record.createdAt)}
        </span>
      </div>

      <div className="bg-slate-950/40 border border-slate-800/40 rounded-xl p-3 mb-2">
        <p className="text-slate-300 text-sm font-mono break-all line-clamp-2 leading-relaxed">
          {record.content || "—"}
        </p>
      </div>
    </div>
  );
}

function TypeBadge({ type }) {
  const map = {
    url:   { icon: <LinkIcon size={11} />,  label: "URL",   cls: "bg-blue-500/10 text-blue-300 border-blue-500/20" },
    file:  { icon: <FileText size={11} />,  label: "FILE",  cls: "bg-violet-500/10 text-violet-300 border-violet-500/20" },
    batch: { icon: <Layers size={11} />,    label: "BATCH", cls: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
    text:  { icon: <Globe size={11} />,     label: "TEXT",  cls: "bg-slate-500/10 text-slate-300 border-slate-500/20" },
  };
  const t = map[type] || map.text;

  return (
    <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${t.cls}`}>
      {t.icon}
      {t.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
      <BarChart2 size={44} className="mx-auto text-slate-700 mb-4" />
      <p className="text-slate-400 font-semibold text-base">You haven&apos;t run any analyses yet</p>
      <p className="text-slate-600 text-sm mt-1">
        When you run an analysis, the results will appear here.
      </p>
    </div>
  );
}

function formatDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  return isNaN(d) ? "—" : d.toLocaleString();
}
