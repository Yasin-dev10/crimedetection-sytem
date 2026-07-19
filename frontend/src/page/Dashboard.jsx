import { useEffect, useState } from "react";
import {
  AlertTriangle,
  FileSearch,
  ShieldCheck,
  Users,
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
    },
    trend: [],
    classificationDistribution: [],
    analysisTypes: [],
    caseStatus: [],
    facebookMonitoring: [],
    topKeywords: [],
    blacklistCrimeChart: [],
    recentAlerts: [],
    recentInvestigations: [],
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
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

  const trendData =
    dashboard.trend?.length > 0
      ? dashboard.trend
      : [{ day: "No Data", crime: 0, safe: 0 }];

  const classificationData = dashboard.classificationDistribution || [];
  const analysisTypes = dashboard.analysisTypes || [];
  const caseStatus = dashboard.caseStatus || [];

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
      title: "Investigator",
      value: dashboard.stats.investigatorUsers,
      icon: Users,
      accent: ACCENT.investigator,
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
      {/* HEADER */}
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

      {/* STATS — same cards, refreshed styling */}
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

      {/* CHARTS — same sections, refreshed cards */}
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
              <Line
                type="monotone"
                dataKey="crime"
                stroke="#ef4444"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="safe"
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
