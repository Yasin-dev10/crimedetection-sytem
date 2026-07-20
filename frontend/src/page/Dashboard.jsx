import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  FileSearch,
  Flag,
  ShieldCheck,
  Globe,
  FolderSearch,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import API from "../api";

const ACCENT = {
  analysis: { bar: "#3b82f6", soft: "rgba(59, 130, 246, 0.12)", icon: "#60a5fa" },
  crime: { bar: "#ef4444", soft: "rgba(239, 68, 68, 0.12)", icon: "#f87171" },
  safe: { bar: "#10b981", soft: "rgba(16, 185, 129, 0.12)", icon: "#34d399" },
  investigator: { bar: "#f59e0b", soft: "rgba(245, 158, 11, 0.12)", icon: "#fbbf24" },
  facebook: { bar: "#06b6d4", soft: "rgba(6, 182, 212, 0.12)", icon: "#22d3ee" },
  cases: { bar: "#8b5cf6", soft: "rgba(139, 92, 246, 0.12)", icon: "#a78bfa" },
  flags: { bar: "#f97316", soft: "rgba(249, 115, 22, 0.12)", icon: "#fb923c" },
};

export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const [dashboard, setDashboard] = useState({
    stats: {
      totalAnalysis: 0,
      crimeDetected: 0,
      safeContent: 0,
      investigatorUsers: 0,
      facebookPages: 0,
      activeCases: 0,
      blacklistTotal: 0,
      falseReports: 0,
    },
    trend: [],
    classificationDistribution: [],
    analysisTypes: [],
    caseStatus: [],
    blacklistCrimeChart: [],
    recentAlerts: [],
    recentInvestigations: [],
  });

  const [loading, setLoading] = useState(true);
  const [recentAudits, setRecentAudits] = useState([]);
  const [auditsLoading, setAuditsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
    loadRecentAudits();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const res = await API.get("/dashboard");
      setDashboard((prev) => ({
        ...prev,
        ...res.data,
      }));
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentAudits = async () => {
    try {
      setAuditsLoading(true);
      const res = await API.get("/audit-logs", {
        params: { page: 1, limit: 8 },
      });
      setRecentAudits(res.data?.items || []);
    } catch (err) {
      console.error("Recent audit error:", err);
      setRecentAudits([]);
    } finally {
      setAuditsLoading(false);
    }
  };

  const trendData =
    dashboard.trend?.length > 0
      ? dashboard.trend
      : [{ day: "No Data", crime: 0, safe: 0 }];

  const classificationData = dashboard.classificationDistribution || [];
  const analysisTypes = dashboard.analysisTypes || [];
  const caseStatus = dashboard.caseStatus || [];
  const blacklistCrimeChart = dashboard.blacklistCrimeChart || [];

  const pieColors = ["#ef4444", "#3b82f6", "#64748b", "#94a3b8"];

  const tooltipStyle = {
    background: "var(--bg-card)",
    border: "1px solid var(--border-base)",
    borderRadius: "12px",
    color: "var(--text-primary)",
    fontSize: "12px",
    boxShadow: "var(--shadow-elevated)",
  };

  const stats = [
    {
      title: "Total Analysis",
      value: dashboard.stats.totalAnalysis,
      icon: FileSearch,
      accent: ACCENT.analysis,
    },
    {
      title: "Crime Detected",
      value: dashboard.stats.crimeDetected,
      icon: AlertTriangle,
      accent: ACCENT.crime,
    },
    {
      title: "Not Crime",
      value: dashboard.stats.safeContent,
      icon: ShieldCheck,
      accent: ACCENT.safe,
    },
    {
      title: "False Reports",
      value: dashboard.stats.falseReports || 0,
      icon: Flag,
      accent: ACCENT.flags,
    },
    {
      title: "Facebook Pages",
      value: dashboard.stats.facebookPages,
      icon: Globe,
      accent: ACCENT.facebook,
    },
    {
      title: "Active Cases",
      value: dashboard.stats.activeCases,
      icon: FolderSearch,
      accent: ACCENT.cases,
    },
  ];

  const axisColor = "var(--chart-axis)";
  const gridColor = "var(--chart-grid)";
  const cursorColor = "var(--chart-grid)";

  return (
    <div
      className="w-full transition-colors duration-300"
      style={{
        backgroundColor: "var(--bg-base)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="text-2xl font-extrabold tracking-tight sm:text-[1.75rem]"
            style={{ color: "var(--text-primary)" }}
          >
            Dashboard
          </h1>
          <p
            className="mt-1 text-sm font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Welcome, {user?.name || "Admin"} — monitor analysis, crime signals,
            and investigation activity.
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="relative overflow-hidden rounded-2xl border px-3.5 py-3.5 transition-shadow duration-300"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-base)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <span
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ backgroundColor: item.accent.bar }}
              />
              <div className="flex items-start justify-between gap-2 pl-1.5">
                <div className="min-w-0">
                  <p
                    className="text-[11px] font-bold uppercase tracking-[0.08em]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {item.title}
                  </p>
                  <p
                    className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {loading ? "…" : item.value}
                  </p>
                </div>
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: item.accent.soft,
                    color: item.accent.icon,
                  }}
                >
                  <Icon size={16} strokeWidth={2.25} />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Crime Trend">
          <ResponsiveContainer height={240}>
            <LineChart
              data={trendData}
              margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                stroke={gridColor}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="day"
                stroke={axisColor}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke={axisColor}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: "12px" }} />
              <Line
                type="monotone"
                dataKey="crime"
                name="Crime"
                stroke="#ef4444"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="safe"
                name="Not Crime"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#3b82f6", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Crime vs Not Crime">
          <ResponsiveContainer height={240}>
            <PieChart>
              <Pie
                data={classificationData}
                dataKey="value"
                nameKey="name"
                outerRadius={78}
                innerRadius={44}
                paddingAngle={3}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
              >
                {classificationData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={pieColors[i % pieColors.length]}
                    className="focus:outline-none"
                  />
                ))}
              </Pie>
              <Legend
                iconType="circle"
                wrapperStyle={{ paddingTop: "8px", fontSize: "12px" }}
              />
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Analysis Types">
          {analysisTypes.length === 0 ? (
            <EmptyChart text="No analysis types yet." />
          ) : (
            <ResponsiveContainer height={240}>
              <BarChart
                data={analysisTypes}
                margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="barAnalysis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  stroke={gridColor}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="type"
                  stroke={axisColor}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={axisColor}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: cursorColor, opacity: 0.35 }}
                />
                <Bar
                  dataKey="count"
                  fill="url(#barAnalysis)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Investigation Status">
          <ResponsiveContainer height={240}>
            <BarChart
              data={caseStatus}
              margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="barCases" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1E3A8A" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke={gridColor}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="status"
                stroke={axisColor}
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke={axisColor}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: cursorColor, opacity: 0.35 }}
              />
              <Bar
                dataKey="count"
                fill="url(#barCases)"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Blacklist Matches">
          {blacklistCrimeChart.length === 0 ? (
            <EmptyChart text="No blacklist match alerts yet." />
          ) : (
            <ResponsiveContainer height={240}>
              <BarChart
                data={blacklistCrimeChart}
                margin={{ top: 8, right: 8, left: -20, bottom: 40 }}
              >
                <CartesianGrid
                  stroke={gridColor}
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke={axisColor}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  stroke={axisColor}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: cursorColor, opacity: 0.35 }}
                />
                <Bar dataKey="count" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Recent Investigations">
          {(dashboard.recentInvestigations || []).length === 0 ? (
            <EmptyChart text="No recent investigations." />
          ) : (
            <div className="max-h-[240px] space-y-2 overflow-y-auto pr-1">
              {(dashboard.recentInvestigations || []).map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border px-3 py-2.5"
                  style={{
                    background: "var(--bg-surface)",
                    borderColor: "var(--border-soft)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {item.title || "Case"}
                    </p>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{
                        background: "var(--brand-soft)",
                        color: "var(--brand)",
                      }}
                    >
                      {formatLabel(item.status)}
                    </span>
                  </div>
                  <p
                    className="mt-1 line-clamp-2 text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {item.content || "No content"}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Recent Audit table */}
      <div
        className="mt-4 overflow-hidden rounded-2xl border"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-base)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5"
          style={{ borderColor: "var(--border-base)" }}
        >
          <div>
            <h2
              className="text-sm font-bold tracking-tight sm:text-[15px]"
              style={{ color: "var(--text-primary)" }}
            >
              Recent Audit
            </h2>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
              Latest system activity from Audit Logs
            </p>
          </div>
          <Link
            to="/audit-logs"
            className="rounded-xl px-3 py-2 text-xs font-bold transition-opacity hover:opacity-90"
            style={{
              background: "var(--navy)",
              color: "white",
            }}
          >
            View all
          </Link>
        </div>

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
              {auditsLoading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Loading recent audit…
                  </td>
                </tr>
              ) : recentAudits.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No recent audit entries.
                  </td>
                </tr>
              ) : (
                recentAudits.map((log) => (
                  <tr
                    key={log.id || log._id}
                    style={{ borderBottom: "1px solid var(--border-base)" }}
                  >
                    <td
                      className="whitespace-nowrap px-4 py-3 font-medium"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div
                        className="font-semibold"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {log.user?.name || log.userName || "Unknown"}
                      </div>
                      {log.user?.email && (
                        <div
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {log.user.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={log.role || log.user?.role} />
                    </td>
                    <td
                      className="whitespace-nowrap px-4 py-3 font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {log.actionLabel || log.action}
                    </td>
                    <td
                      className="whitespace-nowrap px-4 py-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {log.module || "—"}
                    </td>
                    <td
                      className="max-w-[280px] truncate px-4 py-3"
                      style={{ color: "var(--text-secondary)" }}
                      title={log.description}
                    >
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
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border p-4 transition-colors duration-300 sm:p-5"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border-base)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2
          className="text-sm font-bold tracking-tight sm:text-[15px]"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ text }) {
  return (
    <div
      className="flex h-[240px] items-center justify-center text-sm"
      style={{ color: "var(--text-muted)" }}
    >
      {text}
    </div>
  );
}

function formatLabel(value = "") {
  return String(value).replace(/_/g, " ");
}

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
    admin: {
      bg: "rgba(139, 92, 246, 0.12)",
      color: "#a78bfa",
      border: "rgba(139, 92, 246, 0.3)",
    },
    investigator: {
      bg: "rgba(59, 130, 246, 0.12)",
      color: "#60a5fa",
      border: "rgba(59, 130, 246, 0.3)",
    },
    user: {
      bg: "rgba(100, 116, 139, 0.12)",
      color: "#94a3b8",
      border: "rgba(100, 116, 139, 0.3)",
    },
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
      className="inline-flex rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{
        backgroundColor: ok
          ? "rgba(34, 197, 94, 0.12)"
          : "rgba(239, 68, 68, 0.12)",
        color: ok ? "#22c55e" : "#ef4444",
        borderColor: ok ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)",
      }}
    >
      {ok ? "Success" : "Failed"}
    </span>
  );
}
