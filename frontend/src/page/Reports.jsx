import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FileBarChart2, Globe, Calendar, CalendarDays,
  AlertTriangle, ShieldCheck, Download, RefreshCw,
  Layers, ChevronDown, ShieldAlert, SlidersHorizontal, Check,
  FileText, FileSpreadsheet, ExternalLink, Activity, ChevronRight,
  ShieldX, UserX, ChevronUp, UserRound, ClipboardList,
  LogIn, LogOut, Briefcase, CheckCircle2, Clock3, Users,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import API from "../api";
import useTheme from "../useTheme";
import { getStoredUser } from "../theme";
import { exportReportCSV, exportReportExcel, exportReportPDF } from "../utils/reportExport";

const FAKE_CRIMES_THRESHOLD = 3;

const BASE_REPORT_TYPES = [
  { id: "general",    label: "General Report",    icon: Globe },
  { id: "weekly",     label: "Weekly Report",     icon: CalendarDays },
  { id: "monthly",    label: "Monthly Report",    icon: Calendar },
  { id: "individual", label: "Individual Report", icon: ShieldAlert },
  { id: "fake-crimes-full", label: "Fake Crimes Full", icon: ShieldX },
  { id: "fake-crimes-individual", label: "Fake Crime Individual", icon: UserX },
];

const ADMIN_REPORT_TYPES = [
  { id: "crime-cases", label: "Crime Report", icon: Briefcase },
  { id: "investigator-activity", label: "Investigator Activity", icon: Activity },
];

const CRIME_PERIOD_TYPES = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
  { id: "custom", label: "Custom Range" },
];

/** Investigators only see reports of their own work — never system-wide aggregates. */
const INVESTIGATOR_REPORT_TYPES = [
  { id: "my-work", label: "My Work Report", icon: ClipboardList },
  { id: "my-activity", label: "My Activity Report", icon: UserRound },
];

function isFakeCrimesReportType(type) {
  return type === "fake-crimes-full" || type === "fake-crimes-individual";
}

function isSelectionRequiredReport(type) {
  return type === "individual" || type === "fake-crimes-individual";
}

function isCrimeCasesReportType(type) {
  return type === "crime-cases";
}

function todayLocalISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function formatDateTimeShort(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatReportPeriodLabel(period) {
  if (!period) return "—";
  if (typeof period === "string") return period;
  if (period.label) return period.label;
  if (period.from || period.to) {
    return `${period.from || ""} → ${period.to || ""}`.trim();
  }
  return "—";
}

function formatActionLabel(action) {
  if (!action) return "Unknown action";
  return String(action)
    .replace(/[_.-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

const CHART_CRIME = "#ef4444";
const currentYear  = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const YEARS  = Array.from({ length: 5 }, (_, i) => currentYear - i);
const MONTHS = [
  { v: 1, l: "January" }, { v: 2, l: "February" }, { v: 3, l: "March" },
  { v: 4, l: "April" },   { v: 5, l: "May" },       { v: 6, l: "June" },
  { v: 7, l: "July" },    { v: 8, l: "August" },    { v: 9, l: "September" },
  { v: 10, l: "October" },{ v: 11, l: "November" }, { v: 12, l: "December" },
];

const REPORT_SOURCES = [
  { id: "all", label: "All sources" },
  { id: "facebook", label: "Facebook only" },
  { id: "website", label: "Website only" },
];

function supportsSourceFilter(type) {
  return type === "general" || type === "monthly" || type === "weekly";
}

/** Explicit palettes — no CSS vars in charts/UI so light mode never inherits dark colors */
const THEME = {
  light: {
    page: "#e9eef9",
    card: "#ffffff",
    elevated: "#dbe4f5",
    text: "#0f172a",
    secondary: "#334155",
    muted: "#64748b",
    border: "#c3d0ea",
    brand: "#1E3A8A",
    brandSoft: "rgba(30, 58, 138, 0.14)",
    brandRing: "rgba(30, 58, 138, 0.45)",
    danger: "#dc2626",
    dangerSoft: "rgba(220, 38, 38, 0.12)",
    warn: "#d97706",
    warnSoft: "rgba(245, 158, 11, 0.12)",
    warnBorder: "rgba(245, 158, 11, 0.35)",
    axis: "#64748b",
    grid: "#e8edf5",
    shadow: "0 1px 2px rgba(15, 23, 42, 0.05), 0 0 0 1px rgba(15, 23, 42, 0.04)",
    tooltipShadow: "0 8px 28px rgba(15, 23, 42, 0.1)",
  },
  dark: {
    page: "#0a0d14",
    card: "#141b2d",
    elevated: "#1a2338",
    text: "#ffffff",
    secondary: "#a0aec0",
    muted: "#6b7a99",
    border: "#1e2d4a",
    brand: "#06B6D4",
    brandSoft: "rgba(6, 182, 212, 0.12)",
    brandRing: "rgba(6, 182, 212, 0.35)",
    danger: "#f87171",
    dangerSoft: "rgba(239, 68, 68, 0.15)",
    warn: "#fbbf24",
    warnSoft: "rgba(245, 158, 11, 0.12)",
    warnBorder: "rgba(245, 158, 11, 0.35)",
    axis: "#64748b",
    grid: "#1e2d4a",
    shadow: "0 1px 3px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.04)",
    tooltipShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
  },
};

export default function Reports() {
  const { theme, isLight } = useTheme();
  const t = THEME[isLight ? "light" : "dark"];
  const storedUser = getStoredUser();
  const isAdmin = storedUser?.role === "admin";
  const isInvestigator = storedUser?.role === "investigator";
  const REPORT_TYPES = useMemo(
    () => {
      if (isAdmin) return [...BASE_REPORT_TYPES, ...ADMIN_REPORT_TYPES];
      if (isInvestigator) return INVESTIGATOR_REPORT_TYPES;
      return [];
    },
    [isAdmin, isInvestigator]
  );

  const [activeType, setActiveType]   = useState(() =>
    storedUser?.role === "investigator" ? "my-work" : "general"
  );
  const [report,     setReport]       = useState(null);
  const [loading,    setLoading]      = useState(false);
  const [error,      setError]        = useState("");

  const [blacklistItems, setBlacklistItems] = useState([]);
  const [selectedBlacklistId, setSelectedBlacklistId] = useState("");
  const [selectedSource, setSelectedSource] = useState("all");
  const [selYear,  setSelYear]  = useState(currentYear);
  const [selMonth, setSelMonth] = useState(currentMonth);
  const [weekFrom, setWeekFrom] = useState("");
  const [weekTo,   setWeekTo]   = useState("");
  const [crimePeriod, setCrimePeriod] = useState("monthly");
  const [crimeDate, setCrimeDate] = useState(todayLocalISO);
  const [crimeFrom, setCrimeFrom] = useState("");
  const [crimeTo, setCrimeTo] = useState("");
  const [activityFrom, setActivityFrom] = useState(todayLocalISO);
  const [activityTo, setActivityTo] = useState(todayLocalISO);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const downloadRef = useRef(null);

  useEffect(() => {
    if (isInvestigator) {
      const allowed = new Set(INVESTIGATOR_REPORT_TYPES.map((r) => r.id));
      if (!allowed.has(activeType)) {
        setActiveType("my-work");
        setReport(null);
      }
      return;
    }
    if (!isAdmin && (activeType === "investigator-activity" || activeType === "crime-cases")) {
      setActiveType("general");
      setReport(null);
    }
  }, [isAdmin, isInvestigator, activeType]);

  useEffect(() => {
    if (!filtersOpen && !downloadOpen) return undefined;
    const onPointerDown = (event) => {
      if (filtersRef.current && !filtersRef.current.contains(event.target)) {
        setFiltersOpen(false);
      }
      if (downloadRef.current && !downloadRef.current.contains(event.target)) {
        setDownloadOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [filtersOpen, downloadOpen]);

  const fieldStyle = {
    backgroundColor: t.elevated,
    borderColor: t.border,
    color: t.text,
  };

  const tooltipStyle = {
    background: t.card,
    border: `1px solid ${t.border}`,
    borderRadius: "12px",
    color: t.text,
    fontSize: "12px",
    boxShadow: t.tooltipShadow,
  };

  useEffect(() => {
    API.get("/blacklist")
      .then((r) => setBlacklistItems(r.data || []))
      .catch(() => {});
  }, []);

  const fetchReport = useCallback(async () => {
    setError("");
    setLoading(true);
    setReport(null);
    try {
      if (activeType === "my-work") {
        if (!isInvestigator) {
          setError("My Work report is available to investigator accounts only.");
          setLoading(false);
          return;
        }
        const res = await API.get("/reports/my-work");
        setReport(res.data);
        return;
      }

      if (activeType === "crime-cases") {
        if (!isAdmin) {
          setError("Crime reports are available to admins only.");
          setLoading(false);
          return;
        }
        const params = new URLSearchParams();
        params.set("period", crimePeriod);
        const today = todayLocalISO();

        if (crimePeriod === "daily") {
          if (!crimeDate) {
            setError("Please select a date for the daily report.");
            setLoading(false);
            return;
          }
          if (crimeDate > today) {
            setError("Cannot generate a report for a future date.");
            setLoading(false);
            return;
          }
          params.set("date", crimeDate);
        } else if (crimePeriod === "weekly") {
          if ((crimeFrom && !crimeTo) || (!crimeFrom && crimeTo)) {
            setError("Please provide both a start date and an end date for the weekly report.");
            setLoading(false);
            return;
          }
          if (crimeFrom && crimeTo) {
            if (crimeFrom > crimeTo) {
              setError("Start date cannot be after end date.");
              setLoading(false);
              return;
            }
            if (crimeTo > today) {
              setError("End date cannot be in the future.");
              setLoading(false);
              return;
            }
            const from = new Date(crimeFrom);
            const to = new Date(crimeTo);
            const diffDays = Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;
            if (diffDays > 7) {
              setError("Weekly report range cannot exceed 7 days.");
              setLoading(false);
              return;
            }
            params.set("from", crimeFrom);
            params.set("to", crimeTo);
          }
        } else if (crimePeriod === "monthly") {
          params.set("year", String(selYear));
          params.set("month", String(selMonth));
        } else if (crimePeriod === "yearly") {
          params.set("year", String(selYear));
        } else if (crimePeriod === "custom") {
          if (!crimeFrom || !crimeTo) {
            setError("Custom range requires both a start date and an end date.");
            setLoading(false);
            return;
          }
          if (crimeFrom > crimeTo) {
            setError("Start date cannot be after end date.");
            setLoading(false);
            return;
          }
          if (crimeTo > today) {
            setError("End date cannot be in the future.");
            setLoading(false);
            return;
          }
          params.set("from", crimeFrom);
          params.set("to", crimeTo);
        }

        const res = await API.get(`/reports/crime-cases?${params}`);
        setReport(res.data);
        return;
      }

      if (activeType === "investigator-activity" || activeType === "my-activity") {
        if (activeType === "investigator-activity" && !isAdmin) {
          setError("Investigator activity reports are available to admins only.");
          setLoading(false);
          return;
        }
        if (activeType === "my-activity" && !isInvestigator) {
          setError("My Activity Report is available to investigator accounts only.");
          setLoading(false);
          return;
        }
        if (!activityFrom || !activityTo) {
          setError("Please provide both a start date and an end date.");
          setLoading(false);
          return;
        }
        const from = new Date(activityFrom);
        const to = new Date(activityTo);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
          setError("Invalid date format. Please use the date picker.");
          setLoading(false);
          return;
        }
        if (from > to) {
          setError("Start date cannot be after end date.");
          setLoading(false);
          return;
        }
        const params = new URLSearchParams();
        params.set("from", activityFrom);
        params.set("to", activityTo);
        const endpoint =
          activeType === "my-activity"
            ? "/reports/my-activity"
            : "/reports/investigator-activity";
        const res = await API.get(`${endpoint}?${params}`);
        setReport(res.data);
        return;
      }

      if (isFakeCrimesReportType(activeType)) {
        if (activeType === "fake-crimes-individual" && !selectedBlacklistId) {
          setError("Please select a blacklist entry.");
          setLoading(false);
          return;
        }
        const params = new URLSearchParams();
        params.set("threshold", String(FAKE_CRIMES_THRESHOLD));
        if (activeType === "fake-crimes-individual") {
          params.set("blacklistId", selectedBlacklistId);
        }
        const res = await API.get(`/reports/fake-crimes?${params}`);
        setReport(res.data);
        return;
      }

      if (activeType === "individual") {
        if (!selectedBlacklistId) {
          setError("Please select a blacklist entry.");
          setLoading(false);
          return;
        }

        const params = new URLSearchParams();
        params.set("blacklistId", selectedBlacklistId);
        const res = await API.get(`/reports/individual?${params}`);
        setReport(res.data);
        return;
      }

      if (activeType === "monthly") {
        const now = new Date();
        const selectedDate = new Date(selYear, selMonth - 1, 1);
        const thisMonth    = new Date(now.getFullYear(), now.getMonth(), 1);

        if (selYear < 2000 || selYear > now.getFullYear() + 1) {
          setError(`Year must be between 2000 and ${now.getFullYear() + 1}.`);
          setLoading(false);
          return;
        }
        if (selectedDate > thisMonth) {
          setError("Cannot generate a report for a future month.");
          setLoading(false);
          return;
        }
      }

      if (activeType === "weekly") {
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        if ((weekFrom && !weekTo) || (!weekFrom && weekTo)) {
          setError("Please provide both a start date and an end date for the custom range.");
          setLoading(false);
          return;
        }

        if (weekFrom && weekTo) {
          const from = new Date(weekFrom);
          const to   = new Date(weekTo);

          if (isNaN(from.getTime()) || isNaN(to.getTime())) {
            setError("Invalid date format. Please use the date picker.");
            setLoading(false);
            return;
          }
          if (from > to) {
            setError("Start date cannot be after end date.");
            setLoading(false);
            return;
          }
          if (from > today) {
            setError("Start date cannot be in the future.");
            setLoading(false);
            return;
          }
          if (to > today) {
            setError("End date cannot be in the future.");
            setLoading(false);
            return;
          }
          const diffDays = Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;
          if (diffDays > 7) {
            setError("Custom range cannot exceed 7 days for a weekly report.");
            setLoading(false);
            return;
          }
          if (diffDays < 1) {
            setError("Date range must be at least 1 day.");
            setLoading(false);
            return;
          }
        }
      }

      let url = `/reports/${activeType}`;
      const params = new URLSearchParams();

      if (supportsSourceFilter(activeType)) {
        params.set("source", selectedSource);
      }
      if (activeType === "monthly") {
        params.set("year",  selYear);
        params.set("month", selMonth);
      }
      if (activeType === "weekly" && weekFrom && weekTo) {
        params.set("from", weekFrom);
        params.set("to",   weekTo);
      }
      if (selectedBlacklistId && (activeType === "monthly" || activeType === "weekly")) {
        params.set("blacklistId", selectedBlacklistId);
      }

      const qs = params.toString();
      const res = await API.get(qs ? `${url}?${qs}` : url);
      setReport(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load report.");
    } finally {
      setLoading(false);
    }
  }, [activeType, selectedBlacklistId, selectedSource, selYear, selMonth, weekFrom, weekTo, activityFrom, activityTo, crimePeriod, crimeDate, crimeFrom, crimeTo, isAdmin, isInvestigator]);

  useEffect(() => {
    if (isSelectionRequiredReport(activeType)) {
      setReport(null);
      return;
    }
    if (isCrimeCasesReportType(activeType)) {
      setReport(null);
      return;
    }
    fetchReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType, selYear, selMonth, selectedBlacklistId, selectedSource]);

  return (
    <div
      className="reports-page w-full transition-colors duration-300"
      style={{
        backgroundColor: t.page,
        color: t.text,
        fontFamily: "var(--font-sans)",
      }}
    >
      <div className="page-header" style={{ borderColor: t.border }}>
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: t.brandSoft, color: t.brand }}
          >
            <FileBarChart2 size={20} />
          </span>
          <div>
            <h1 className="page-title" style={{ color: t.text }}>Reports</h1>
           
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
          <div className="relative" ref={filtersRef}>
            <button
              type="button"
              onClick={() => { setFiltersOpen((open) => !open); setDownloadOpen(false); }}
              className="inline-flex h-[42px] items-center gap-2.5 rounded-xl border px-4 text-sm font-bold transition"
              style={{
                backgroundColor: filtersOpen ? t.brandSoft : t.card,
                borderColor: filtersOpen ? t.brandRing : t.border,
                color: t.text,
                boxShadow: t.shadow,
              }}
            >
              <SlidersHorizontal size={16} style={{ color: t.brand }} />
              {REPORT_TYPES.find((r) => r.id === activeType)?.label}
              <ChevronDown
                size={15}
                className={`transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
                style={{ color: t.muted }}
              />
            </button>

            {filtersOpen && (
              <div
                className="absolute right-0 top-[calc(100%+8px)] z-40 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border p-4"
                style={{
                  backgroundColor: t.card,
                  borderColor: t.border,
                  boxShadow: t.tooltipShadow,
                }}
              >
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: t.muted }}>
                  Report type
                </p>
                <div className="mb-4 grid grid-cols-2 gap-1.5">
                  {REPORT_TYPES.map(({ id, label, icon: Icon }) => {
                    const active = activeType === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { setActiveType(id); setReport(null); setError(""); }}
                        className="flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition"
                        style={{
                          backgroundColor: active ? t.brand : t.elevated,
                          borderColor: active ? t.brand : t.border,
                          color: active ? "#ffffff" : t.secondary,
                        }}
                      >
                        <Icon size={14} className="shrink-0 opacity-80" />
                        <span className="flex-1 truncate">{label.replace(" Report", "")}</span>
                        {active && <Check size={13} className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {supportsSourceFilter(activeType) && (
                  <div className="mb-3">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: t.muted }}>
                      Report source
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {REPORT_SOURCES.map((source) => {
                        const active = selectedSource === source.id;
                        return (
                          <button
                            key={source.id}
                            type="button"
                            onClick={() => {
                              setSelectedSource(source.id);
                              setSelectedBlacklistId("");
                              setReport(null);
                            }}
                            className="rounded-xl border px-2 py-2 text-xs font-semibold transition"
                            style={{
                              backgroundColor: active ? t.brand : t.elevated,
                              borderColor: active ? t.brand : t.border,
                              color: active ? "#ffffff" : t.secondary,
                            }}
                          >
                            {source.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(activeType === "individual"
                  || activeType === "fake-crimes-individual"
                  || activeType === "monthly"
                  || activeType === "weekly") && (
                  <div className="mb-3">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: t.muted }}>
                      {isSelectionRequiredReport(activeType) ? "Blacklist entry" : "Blacklist (optional)"}
                    </p>
                    <div className="relative">
                      <select
                        value={selectedBlacklistId}
                        onChange={(e) => setSelectedBlacklistId(e.target.value)}
                        className="w-full appearance-none rounded-xl border px-3 py-2.5 pr-8 text-sm focus:outline-none"
                        style={fieldStyle}
                      >
                        <option value="">
                          {isSelectionRequiredReport(activeType) ? "-- Choose blacklist --" : "All blacklist items"}
                        </option>
                        {blacklistItems
                          .filter((item) => {
                            if (!supportsSourceFilter(activeType) || selectedSource === "all") return true;
                            if (selectedSource === "facebook") return item.type === "facebook_page";
                            return item.type === "website";
                          })
                          .map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.name || item.value} ({item.type})
                          </option>
                          ))}
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3.5" style={{ color: t.muted }} />
                    </div>
                  </div>
                )}

                {isFakeCrimesReportType(activeType) && (
                  <p
                    className="mb-3 rounded-xl border px-3 py-2.5 text-xs leading-relaxed"
                    style={{
                      borderColor: t.warnBorder,
                      backgroundColor: t.warnSoft,
                      color: t.secondary,
                    }}
                  >
                    {activeType === "fake-crimes-full" ? (
                      <>
                        Threshold {FAKE_CRIMES_THRESHOLD}: this full report includes
                        subjects with at least{" "}
                        <strong style={{ color: t.text }}>{FAKE_CRIMES_THRESHOLD}</strong>{" "}
                        investigator-confirmed fake (not-crime) reports.
                      </>
                    ) : (
                      <>
                        Select one blacklist subject to download all of their
                        investigator-confirmed fake reports. Individual reports are
                        available even when the subject has fewer than{" "}
                        <strong style={{ color: t.text }}>{FAKE_CRIMES_THRESHOLD}</strong>.
                      </>
                    )}
                  </p>
                )}

                {activeType === "monthly" && (
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: t.muted }}>Year</p>
                      <div className="relative">
                        <select
                          value={selYear}
                          onChange={(e) => setSelYear(+e.target.value)}
                          className="w-full appearance-none rounded-xl border px-3 py-2.5 pr-8 text-sm focus:outline-none"
                          style={fieldStyle}
                        >
                          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3.5" style={{ color: t.muted }} />
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: t.muted }}>Month</p>
                      <div className="relative">
                        <select
                          value={selMonth}
                          onChange={(e) => setSelMonth(+e.target.value)}
                          className="w-full appearance-none rounded-xl border px-3 py-2.5 pr-8 text-sm focus:outline-none"
                          style={fieldStyle}
                        >
                          {MONTHS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                        </select>
                        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3.5" style={{ color: t.muted }} />
                      </div>
                    </div>
                  </div>
                )}

                {activeType === "weekly" && (
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: t.muted }}>From (optional)</p>
                      <input
                        type="date"
                        value={weekFrom}
                        max={weekTo || new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setWeekFrom(e.target.value)}
                        className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none"
                        style={fieldStyle}
                      />
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: t.muted }}>To (optional)</p>
                      <input
                        type="date"
                        value={weekTo}
                        min={weekFrom || undefined}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setWeekTo(e.target.value)}
                        className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none"
                        style={fieldStyle}
                      />
                    </div>
                  </div>
                )}

                {activeType === "crime-cases" && (
                  <div className="mb-3 space-y-3">
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: t.muted }}>
                        Date filter
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {CRIME_PERIOD_TYPES.map((p) => {
                          const active = crimePeriod === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setCrimePeriod(p.id);
                                setReport(null);
                              }}
                              className="rounded-xl border px-2 py-2 text-xs font-semibold transition"
                              style={{
                                backgroundColor: active ? t.brand : t.elevated,
                                borderColor: active ? t.brand : t.border,
                                color: active ? "#ffffff" : t.secondary,
                              }}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {crimePeriod === "daily" && (
                      <div>
                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: t.muted }}>Date</p>
                        <input
                          type="date"
                          value={crimeDate}
                          max={todayLocalISO()}
                          onChange={(e) => setCrimeDate(e.target.value)}
                          className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none"
                          style={fieldStyle}
                        />
                      </div>
                    )}

                    {(crimePeriod === "weekly" || crimePeriod === "custom") && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: t.muted }}>
                            {crimePeriod === "weekly" ? "From (optional)" : "From"}
                          </p>
                          <input
                            type="date"
                            value={crimeFrom}
                            max={crimeTo || todayLocalISO()}
                            onChange={(e) => setCrimeFrom(e.target.value)}
                            className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none"
                            style={fieldStyle}
                          />
                        </div>
                        <div>
                          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: t.muted }}>
                            {crimePeriod === "weekly" ? "To (optional)" : "To"}
                          </p>
                          <input
                            type="date"
                            value={crimeTo}
                            min={crimeFrom || undefined}
                            max={todayLocalISO()}
                            onChange={(e) => setCrimeTo(e.target.value)}
                            className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none"
                            style={fieldStyle}
                          />
                        </div>
                      </div>
                    )}

                    {crimePeriod === "monthly" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: t.muted }}>Year</p>
                          <div className="relative">
                            <select
                              value={selYear}
                              onChange={(e) => setSelYear(+e.target.value)}
                              className="w-full appearance-none rounded-xl border px-3 py-2.5 pr-8 text-sm focus:outline-none"
                              style={fieldStyle}
                            >
                              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                            </select>
                            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3.5" style={{ color: t.muted }} />
                          </div>
                        </div>
                        <div>
                          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: t.muted }}>Month</p>
                          <div className="relative">
                            <select
                              value={selMonth}
                              onChange={(e) => setSelMonth(+e.target.value)}
                              className="w-full appearance-none rounded-xl border px-3 py-2.5 pr-8 text-sm focus:outline-none"
                              style={fieldStyle}
                            >
                              {MONTHS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                            </select>
                            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3.5" style={{ color: t.muted }} />
                          </div>
                        </div>
                      </div>
                    )}

                    {crimePeriod === "yearly" && (
                      <div>
                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: t.muted }}>Year</p>
                        <div className="relative">
                          <select
                            value={selYear}
                            onChange={(e) => setSelYear(+e.target.value)}
                            className="w-full appearance-none rounded-xl border px-3 py-2.5 pr-8 text-sm focus:outline-none"
                            style={fieldStyle}
                          >
                            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                          </select>
                          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-3.5" style={{ color: t.muted }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(activeType === "investigator-activity" || activeType === "my-activity") && (
                  <div className="mb-3 grid grid-cols-2 gap-2">
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: t.muted }}>From</p>
                      <input
                        type="date"
                        value={activityFrom}
                        max={activityTo || todayLocalISO()}
                        onChange={(e) => setActivityFrom(e.target.value)}
                        className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none"
                        style={fieldStyle}
                      />
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: t.muted }}>To</p>
                      <input
                        type="date"
                        value={activityTo}
                        min={activityFrom || undefined}
                        max={todayLocalISO()}
                        onChange={(e) => setActivityTo(e.target.value)}
                        className="w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none"
                        style={fieldStyle}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { setFiltersOpen(false); fetchReport(); }}
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-50"
                  style={{ backgroundColor: t.brand }}
                >
                  <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                  {loading ? "Preparing…" : "Create report"}
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={fetchReport}
            disabled={loading}
            title="Refresh report"
            className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl text-white transition disabled:opacity-50"
            style={{ backgroundColor: t.brand }}
          >
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          </button>

          <div className="relative" ref={downloadRef}>
            <button
              type="button"
              onClick={() => {
                if (!report) return;
                setDownloadOpen((open) => !open);
                setFiltersOpen(false);
              }}
              disabled={!report}
              className="inline-flex h-[42px] items-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition disabled:opacity-45"
              style={{ backgroundColor: t.brand }}
            >
              <Download size={16} />
              Download
              <ChevronDown
                size={15}
                className={`transition-transform duration-200 ${downloadOpen ? "rotate-180" : ""}`}
              />
            </button>

            {downloadOpen && report && (
              <div
                className="absolute right-0 top-[calc(100%+8px)] z-40 w-52 overflow-hidden rounded-xl border p-1.5"
                style={{
                  backgroundColor: t.card,
                  borderColor: t.border,
                  boxShadow: t.tooltipShadow,
                }}
              >
                {[
                  { label: "Export PDF", icon: FileText, action: exportReportPDF },
                  { label: "Export Excel", icon: FileSpreadsheet, action: exportReportExcel },
                  { label: "Export CSV", icon: Download, action: exportReportCSV },
                ].map(({ label, icon: Icon, action }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => { action(report); setDownloadOpen(false); }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition hover:opacity-80"
                    style={{ color: t.text }}
                  >
                    <Icon size={15} style={{ color: t.brand }} />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="mb-4 text-sm font-medium" style={{ color: t.danger }}>{error}</p>
      )}

      {loading && (
        <div className="flex items-center justify-center py-24">
          <RefreshCw size={32} className="animate-spin" style={{ color: t.brand }} />
          <span className="ml-3 text-lg" style={{ color: t.muted }}>Preparing your report…</span>
        </div>
      )}

      {!loading && report && report.reportType === "investigator-activity" && (
        <InvestigatorActivityReport t={t} report={report} />
      )}

      {!loading && report && report.reportType === "my-work" && (
        <MyWorkReport t={t} report={report} />
      )}

      {!loading && report && report.reportType === "crime-cases" && (
        <CrimeCasesReport t={t} report={report} />
      )}

      {!loading && report && isFakeCrimesReportType(report.reportType) && (
        <FakeCrimesReport t={t} report={report} />
      )}

      {!loading && report
        && report.reportType !== "investigator-activity"
        && report.reportType !== "my-work"
        && report.reportType !== "crime-cases"
        && !isFakeCrimesReportType(report.reportType) && (
        <div className="space-y-6">
          <div
            className="flex flex-col justify-between gap-4 rounded-2xl border p-5 sm:flex-row"
            style={{ backgroundColor: t.card, borderColor: t.border, boxShadow: t.shadow }}
          >
            <div>
              <div className="mb-1 flex items-center gap-2">
                <FileBarChart2 size={18} style={{ color: t.brand }} />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: t.muted }}>
                  {report.reportType} report
                </span>
              </div>
              <h2 className="text-xl font-extrabold" style={{ color: t.text }}>{report.period}</h2>
              {report.sourceFilter && report.sourceFilter !== "all" && (
                <span
                  className="mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize"
                  style={{ backgroundColor: t.brandSoft, color: t.brand }}
                >
                  {report.sourceFilter} only
                </span>
              )}
              {report.blacklistItem && (
                <p className="mt-1 break-all text-sm" style={{ color: t.secondary }}>
                  {report.blacklistItem.name} ·{" "}
                  <span className="capitalize">{report.blacklistItem.type}</span> ·{" "}
                  {report.blacklistItem.value}
                </p>
              )}
            </div>
            <div className="self-end text-sm sm:self-start" style={{ color: t.muted }}>
              Generated: {new Date(report.generatedAt).toLocaleString()}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <StatCard t={t} label="Total Analysed" value={report.stats.total} />
            <StatCard t={t} label="Crime" value={report.stats.crime} tone="danger" />
            <StatCard t={t} label="Not Crime" value={report.stats.notCrime} />
          </div>

          {report.blacklist && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <StatCard
                t={t}
                label={report.reportType === "general" ? "Blacklist Items" : "Blacklist Items (Period)"}
                value={report.blacklist.items || 0}
              />
              <StatCard t={t} label="Alerts raised" value={report.blacklist.alerts || 0} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" key={theme}>
            <ChartCard t={t} title="Crime and safe content">
              <ResponsiveContainer height={240}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Crime", value: report.stats.crime },
                      { name: "Not Crime", value: report.stats.notCrime },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={90}
                    innerRadius={52}
                    paddingAngle={4}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {[CHART_CRIME, t.brand].map((c, i) => <Cell key={i} fill={c} />)}
                  </Pie>
                  <Legend
                    iconType="circle"
                    wrapperStyle={{ color: t.secondary, fontSize: 12 }}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            {report.sourceBreakdown?.length > 0 && (
              <ChartCard t={t} title="Where reports came from">
                <ResponsiveContainer height={240}>
                  <BarChart data={report.sourceBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="source" stroke={t.axis} fontSize={12} tickLine={false} tick={{ fill: t.axis }} />
                    <YAxis stroke={t.axis} fontSize={12} tickLine={false} tick={{ fill: t.axis }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill={t.brand} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {report.dailyBreakdown?.length > 0 && (
              <ChartCard t={t} title="Daily activity">
                <ResponsiveContainer height={240}>
                  <LineChart data={report.dailyBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke={t.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey={report.reportType === "weekly" ? "day" : "date"}
                      stroke={t.axis}
                      fontSize={11}
                      tickLine={false}
                      tick={{ fill: t.axis }}
                    />
                    <YAxis stroke={t.axis} fontSize={12} tickLine={false} tick={{ fill: t.axis }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="crime" stroke={CHART_CRIME} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="notCrime" stroke={t.brand} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
                    <Legend wrapperStyle={{ color: t.secondary, fontSize: 12 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>

          {report.blacklist?.topMatches?.length > 0 && (
            <ChartCard t={t} title="Most frequent blacklist matches">
              <div className="space-y-3">
                {report.blacklist.topMatches.map((match, i) => {
                  const hrefCandidate = String(match.value || match.name || "").trim();
                  const href = /^https?:\/\//i.test(hrefCandidate) ? hrefCandidate : null;
                  const label = match.name || match.value;
                  return (
                    <div
                      key={`${match.type}-${match.value}-${i}`}
                      className="flex flex-col justify-between gap-2 rounded-xl border p-3 sm:flex-row sm:items-center"
                      style={{ backgroundColor: t.elevated, borderColor: t.border }}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <ShieldAlert size={15} style={{ color: t.muted }} />
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-full items-center gap-1.5 break-all font-bold hover:underline"
                              style={{ color: t.brand }}
                              title={href}
                            >
                              <span className="truncate">{label}</span>
                              <ExternalLink size={12} className="shrink-0" />
                            </a>
                          ) : (
                            <span className="break-all font-bold" style={{ color: t.text }}>{label}</span>
                          )}
                          {match.value && match.name && match.value !== match.name && !href && (
                            <span className="break-all text-xs" style={{ color: t.muted }}>{match.value}</span>
                          )}
                          <span
                            className="rounded-full border px-2 py-0.5 text-xs"
                            style={{ borderColor: t.border, backgroundColor: t.card, color: t.secondary }}
                          >
                            {match.type}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold" style={{ color: t.text }}>
                        {match.count} matches
                      </span>
                    </div>
                  );
                })}
              </div>
            </ChartCard>
          )}

          {(report.records || report.recentRecords)?.length > 0 && (
            <RecordsTable t={t} records={report.records || report.recentRecords} />
          )}
        </div>
      )}
    </div>
  );
}

function FakeCrimesReport({ t, report }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const subjects = report.subjects || [];
  const stats = report.stats || {};
  const threshold = report.threshold ?? FAKE_CRIMES_THRESHOLD;
  const isIndividual = report.reportType === "fake-crimes-individual";

  useEffect(() => {
    setExpanded(new Set());
  }, [report.generatedAt, report.period, report.reportType]);

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div
        className="flex flex-col justify-between gap-4 rounded-2xl border p-5 sm:flex-row"
        style={{ backgroundColor: t.card, borderColor: t.border, boxShadow: t.shadow }}
      >
        <div>
          <div className="mb-1 flex items-center gap-2">
            {isIndividual ? (
              <UserX size={18} style={{ color: t.brand }} />
            ) : (
              <ShieldX size={18} style={{ color: t.brand }} />
            )}
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: t.muted }}>
              {isIndividual ? "Fake crime individual report" : "Fake crimes full report"}
            </span>
          </div>
          <h2 className="text-xl font-extrabold" style={{ color: t.text }}>
            {report.period || "All investigator-confirmed fake crimes"}
          </h2>
          {report.blacklistItem && (
            <p className="mt-1 break-all text-sm" style={{ color: t.secondary }}>
              {report.blacklistItem.name} ·{" "}
              <span className="capitalize">{report.blacklistItem.type}</span> ·{" "}
              {report.blacklistItem.value}
            </p>
          )}
          <p className="mt-2 text-xs" style={{ color: t.muted }}>
            Threshold {threshold}: subjects with {threshold}+ investigator-confirmed fake reports
          </p>
        </div>
        <div className="self-end text-sm sm:self-start" style={{ color: t.muted }}>
          Generated: {formatDateTime(report.generatedAt)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <StatCard t={t} label="Subjects" value={stats.subjects ?? subjects.length} />
        <StatCard
          t={t}
          label="Total Fake Reports"
          value={stats.totalFakeReports ?? 0}
          tone="danger"
        />
        <StatCard t={t} label="Threshold" value={stats.threshold ?? threshold} />
      </div>

      {subjects.length === 0 ? (
        <div
          className="rounded-2xl border px-5 py-12 text-center"
          style={{ backgroundColor: t.card, borderColor: t.border, boxShadow: t.shadow }}
        >
          <p className="text-sm font-semibold" style={{ color: t.text }}>
            No subjects met the fake-crime threshold.
          </p>
          <p className="mt-1 text-xs" style={{ color: t.muted }}>
            Subjects appear after at least {threshold} investigator-confirmed not-crime cases.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {subjects.map((row, index) => {
            const item = row.item || {};
            const key = String(item._id || row.subjectId || item.value || `subject-${index}`);
            const isOpen = expanded.has(key);
            const evidence = row.evidence || [];
            const panelId = `fake-crime-evidence-${key}`;

            return (
              <div
                key={key}
                className="overflow-hidden rounded-2xl border"
                style={{ backgroundColor: t.card, borderColor: t.border, boxShadow: t.shadow }}
              >
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="flex w-full flex-col gap-3 p-4 text-left transition hover:opacity-95 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: t.brandSoft, color: t.brand }}
                      aria-hidden="true"
                    >
                      <ChevronRight
                        size={16}
                        className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                      />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold" style={{ color: t.text }}>
                          {item.name || "Unknown subject"}
                        </p>
                        <span
                          className="rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize"
                          style={{ borderColor: t.border, backgroundColor: t.elevated, color: t.secondary }}
                        >
                          {item.type || "—"}
                        </span>
                      </div>
                      <p className="mt-1 break-all text-xs font-medium" style={{ color: t.brand }}>
                        {item.value || "—"}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: t.muted }}>
                        Latest: {formatDateTime(row.latestOccurrenceAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                    <div className="text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: t.danger }}>
                        Fake count
                      </p>
                      <p className="text-2xl font-bold tabular-nums" style={{ color: t.danger }}>
                        {row.fakeCount ?? 0}
                      </p>
                    </div>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold"
                      style={{ borderColor: t.border, backgroundColor: t.elevated, color: t.secondary }}
                    >
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      Evidence ({evidence.length})
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div
                    id={panelId}
                    className="space-y-3 border-t px-4 py-4 sm:px-5"
                    style={{ borderColor: t.border, backgroundColor: t.elevated }}
                  >
                    {evidence.length === 0 ? (
                      <p
                        className="rounded-xl border px-3 py-4 text-sm"
                        style={{ borderColor: t.border, backgroundColor: t.card, color: t.muted }}
                      >
                        No evidence records returned for this subject.
                      </p>
                    ) : (
                      evidence.map((entry, index) => (
                        <FakeCrimeEvidenceCard
                          key={`${entry.caseId || "case"}-${entry.historyId || index}`}
                          t={t}
                          entry={entry}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FakeCrimeEvidenceCard({ t, entry }) {
  const resolverName =
    entry.resolvedByName
    || entry.resolvedBy?.name
    || entry.resolvedByEmail
    || entry.resolvedBy?.email
    || (entry.resolvedByBadge || entry.resolvedBy?.badgeNumber
      ? `Badge ${entry.resolvedByBadge || entry.resolvedBy?.badgeNumber}`
      : "Unknown investigator");
  const badge = entry.resolvedByBadge || entry.resolvedBy?.badgeNumber;
  const postUrl = entry.url && /^https?:\/\//i.test(String(entry.url).trim())
    ? String(entry.url).trim()
    : null;

  return (
    <div
      className="rounded-xl border px-3 py-3 sm:px-4"
      style={{ borderColor: t.border, backgroundColor: t.card }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {entry.sourceType && (
          <span
            className="rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize"
            style={{ borderColor: t.border, backgroundColor: t.elevated, color: t.secondary }}
          >
            {entry.sourceType}
          </span>
        )}
        <span className="ml-auto text-xs tabular-nums" style={{ color: t.muted }}>
          Resolved {formatDateTime(entry.resolvedAt)}
        </span>
      </div>

      <p
        className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed"
        style={{ color: t.secondary }}
      >
        {entry.content || "No content snippet available."}
      </p>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: t.muted }}>
        {(entry.authorName || entry.pageName) && (
          <span className="inline-flex items-center gap-1">
            <UserRound size={12} />
            {[entry.authorName, entry.pageName].filter(Boolean).join(" · ")}
          </span>
        )}
        <span>
          Marked fake by{" "}
          <strong style={{ color: t.text, fontWeight: 600 }}>{resolverName}</strong>
          {badge && resolverName !== `Badge ${badge}` ? ` (Badge ${badge})` : ""}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {entry.caseId && (
          <Link
            to={`/cases?case=${entry.caseId}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:opacity-90"
            style={{ backgroundColor: t.brand }}
          >
            Open Case
          </Link>
        )}
        {postUrl && (
          <a
            href={postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold hover:opacity-90"
            style={{
              borderColor: t.brandRing,
              backgroundColor: t.brandSoft,
              color: t.brand,
            }}
            title={postUrl}
          >
            <span className="truncate">{postUrl}</span>
            <ExternalLink size={10} className="shrink-0" />
          </a>
        )}
      </div>
    </div>
  );
}

function MyWorkReport({ t, report }) {
  const stats = report.stats || {};
  const investigator = report.investigator || {};
  const cases = report.cases || [];
  const formalReports = report.investigationReports || [];

  return (
    <div className="space-y-6">
      <div
        className="flex flex-col justify-between gap-4 rounded-2xl border p-5 sm:flex-row"
        style={{ backgroundColor: t.card, borderColor: t.border, boxShadow: t.shadow }}
      >
        <div>
          <div className="mb-1 flex items-center gap-2">
            <ClipboardList size={18} style={{ color: t.brand }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: t.muted }}>
              My work report
            </span>
          </div>
          <h2 className="text-xl font-extrabold" style={{ color: t.text }}>
            {investigator.name
              ? `${investigator.name}'s investigation work`
              : report.period}
          </h2>
          <p className="mt-1 text-sm" style={{ color: t.secondary }}>
            Only cases and reports assigned to you — not system-wide totals.
          </p>
        </div>
        <div className="self-end text-sm sm:self-start" style={{ color: t.muted }}>
          Generated: {formatDateTime(report.generatedAt)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard t={t} label="My Cases" value={stats.totalCases ?? 0} />
        <StatCard t={t} label="Open" value={stats.open ?? 0} />
        <StatCard t={t} label="Investigating" value={stats.investigating ?? 0} />
        <StatCard t={t} label="Resolved" value={stats.resolved ?? 0} />
        <StatCard t={t} label="Crime" value={stats.crime ?? 0} tone="danger" />
        <StatCard t={t} label="Not Crime" value={stats.notCrime ?? 0} />
        <StatCard t={t} label="My Formal Reports" value={stats.formalReports ?? 0} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard t={t} title="My case outcomes">
          <ResponsiveContainer height={240}>
            <PieChart>
              <Pie
                data={[
                  { name: "Crime", value: stats.crime || 0 },
                  { name: "Not Crime", value: stats.notCrime || 0 },
                  { name: "Open / Active", value: stats.open || 0 },
                ]}
                dataKey="value"
                nameKey="name"
                outerRadius={90}
                innerRadius={52}
                paddingAngle={4}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {[CHART_CRIME, t.brand, t.warn].map((c, i) => (
                  <Cell key={i} fill={c} />
                ))}
              </Pie>
              <Legend iconType="circle" wrapperStyle={{ color: t.secondary, fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: t.card,
                  border: `1px solid ${t.border}`,
                  borderRadius: "12px",
                  color: t.text,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard t={t} title="My formal investigation reports">
          {formalReports.length === 0 ? (
            <p className="py-10 text-center text-sm" style={{ color: t.muted }}>
              No formal reports yet. Create one from Case Details on an assigned case.
            </p>
          ) : (
            <ul className="max-h-[240px] space-y-2 overflow-y-auto pr-1">
              {formalReports.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border px-3 py-2.5"
                  style={{ borderColor: t.border, backgroundColor: t.elevated }}
                >
                  <p className="text-sm font-semibold" style={{ color: t.text }}>
                    {r.title}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: t.muted }}>
                    <span className="uppercase">{r.status}</span>
                    {" · "}
                    Updated {formatDateTime(r.updatedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>

      <ChartCard t={t} title="My assigned cases">
        {cases.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: t.muted }}>
            You have no assigned cases yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {["Case / Content", "Status", "Source / Link", "Resolution", "Updated"].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-3 py-2 text-[11px] font-bold uppercase tracking-wide"
                      style={{ color: t.muted }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => {
                  const fullText = String(c.content || c.contentPreview || "").trim();
                  const urlFromText = (fullText.match(/https?:\/\/[^\s"'<>]+/i) || [])[0] || "";
                  const postUrl = String(c.url || "").trim() || urlFromText;
                  const resolutionText = String(
                    c.findings || c.recommendation || ""
                  ).trim();

                  return (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                    <td className="max-w-md px-3 py-3 align-top">
                      <Link
                        to={`/cases?case=${c.id}`}
                        className="font-semibold hover:underline"
                        style={{ color: t.brand }}
                      >
                        #{String(c.id).slice(-6).toUpperCase()}
                      </Link>
                      <p
                        className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed"
                        style={{ color: t.secondary }}
                      >
                        {fullText || "—"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top capitalize" style={{ color: t.secondary }}>
                      {String(c.status || "").replace(/_/g, " ")}
                    </td>
                    <td className="max-w-[220px] px-3 py-3 align-top" style={{ color: t.secondary }}>
                      <p className="text-xs capitalize">{c.source || "—"}</p>
                      {postUrl ? (
                        <a
                          href={postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex break-all text-xs font-semibold hover:underline"
                          style={{ color: t.brand }}
                          title={postUrl}
                        >
                          {postUrl}
                        </a>
                      ) : (
                        <p className="mt-1 text-xs" style={{ color: t.muted }}>
                          No post link
                        </p>
                      )}
                    </td>
                    <td className="max-w-xs px-3 py-3 align-top">
                      {resolutionText ? (
                        <div className="space-y-1 text-xs" style={{ color: t.secondary }}>
                          {c.findings ? (
                            <p className="whitespace-pre-wrap break-words">
                              <span className="font-bold" style={{ color: t.muted }}>Findings: </span>
                              {c.findings}
                            </p>
                          ) : null}
                          {c.recommendation ? (
                            <p className="whitespace-pre-wrap break-words">
                              <span className="font-bold" style={{ color: t.muted }}>Recommendation: </span>
                              {c.recommendation}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs capitalize" style={{ color: t.muted }}>
                          {String(c.status || "").replace(/_/g, " ") || "—"}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top text-xs" style={{ color: t.muted }}>
                      {formatDateTime(c.updatedAt)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function InvestigatorActivityReport({ t, report }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const investigators = report.investigators || [];
  const stats = report.stats || {};
  const periodLabel = formatReportPeriodLabel(report.period);
  const unresolvedCount = stats.unresolvedCases ?? 0;

  useEffect(() => {
    setExpanded(new Set());
  }, [report.generatedAt, report.period]);

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const summaryStats = [
    {
      label: "Investigators",
      value: stats.investigators ?? investigators.length,
      icon: Users,
      tone: "primary",
    },
    {
      label: "Total Cases",
      value: stats.totalCases ?? 0,
      icon: Briefcase,
      tone: "primary",
    },
    {
      label: "Resolved",
      value: stats.resolvedCases ?? 0,
      icon: CheckCircle2,
      tone: "ok",
    },
    {
      label: "Unresolved",
      value: unresolvedCount,
      icon: AlertTriangle,
      tone: unresolvedCount > 0 ? "danger" : "muted",
    },
    {
      label: "Resolved in Period",
      value: stats.resolvedInPeriod ?? 0,
      icon: Activity,
      tone: "primary",
    },
    {
      label: "Logged In",
      value: stats.loggedInInPeriod ?? 0,
      icon: LogIn,
      tone: "primary",
    },
  ];

  return (
    <div className="space-y-6">
      <div
        className="overflow-hidden rounded-2xl border"
        style={{ backgroundColor: t.card, borderColor: t.border, boxShadow: t.shadow }}
      >
        <div
          className="border-b px-5 py-5 sm:px-6"
          style={{
            borderColor: t.border,
            background: `linear-gradient(135deg, ${t.brandSoft} 0%, transparent 55%)`,
          }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: t.brandSoft, color: t.brand }}
                >
                  <Activity size={18} />
                </span>
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color: t.muted }}>
                  {report.reportScope === "self"
                    ? "My Activity Report"
                    : "Investigator Activity Report"}
                </span>
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight" style={{ color: t.text }}>
                {periodLabel}
              </h2>
              <p className="mt-2 text-sm" style={{ color: t.secondary }}>
                Overview of investigator workload, case resolution, and session activity.
              </p>
            </div>
            <div
              className="shrink-0 rounded-xl border px-4 py-3 text-sm"
              style={{ borderColor: t.border, backgroundColor: t.elevated, color: t.muted }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider">Generated</p>
              <p className="mt-1 font-semibold tabular-nums" style={{ color: t.text }}>
                {formatDateTime(report.generatedAt)}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 sm:p-5 xl:grid-cols-6">
          {summaryStats.map(({ label, value, icon: Icon, tone }) => (
            <ActivityStatTile
              key={label}
              t={t}
              label={label}
              value={value}
              icon={Icon}
              tone={tone}
            />
          ))}
        </div>
      </div>

      {investigators.length === 0 ? (
        <div
          className="rounded-2xl border px-5 py-14 text-center"
          style={{ backgroundColor: t.card, borderColor: t.border, boxShadow: t.shadow }}
        >
          <Users size={32} className="mx-auto mb-3 opacity-40" style={{ color: t.muted }} />
          <p className="text-sm font-semibold" style={{ color: t.text }}>
            No investigators found for this period.
          </p>
          <p className="mt-1 text-xs" style={{ color: t.muted }}>Try a different date range.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-sm font-bold" style={{ color: t.text }}>
              Investigators ({investigators.length})
            </p>
            <p className="text-xs" style={{ color: t.muted }}>
              Expand a row to view sessions and activity log
            </p>
          </div>

          {investigators.map((inv) => {
            const key = inv.officerId || inv.email || inv.name;
            const isOpen = expanded.has(key);
            const activityCount = inv.activityCount ?? (inv.activities || []).length;
            const loginTimes = inv.loginTimes || [];
            const logoutTimes = inv.logoutTimes || [];
            const activities = inv.activities || [];
            const invUnresolved = inv.unresolvedCases ?? 0;
            const isActive = String(inv.status || "").toLowerCase() === "active";

            return (
              <div
                key={key}
                className="overflow-hidden rounded-2xl border transition-shadow"
                style={{
                  backgroundColor: t.card,
                  borderColor: isOpen ? t.brandRing : t.border,
                  boxShadow: isOpen ? t.shadow : t.shadow,
                }}
              >
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-expanded={isOpen}
                  aria-controls={`investigator-detail-${key}`}
                  className="flex w-full flex-col gap-4 p-4 text-left transition hover:opacity-95 sm:p-5 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: t.brandSoft, color: t.brand }}
                      aria-hidden="true"
                    >
                      <ChevronRight
                        size={18}
                        className={`transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
                      />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-bold" style={{ color: t.text }}>
                          {inv.name || "Unnamed investigator"}
                        </p>
                        <StatusPill
                          t={t}
                          label={inv.status || "unknown"}
                          tone={isActive ? "ok" : "muted"}
                        />
                      </div>
                      <p className="mt-1 text-sm" style={{ color: t.secondary }}>
                        Badge {inv.badgeNumber || "—"} · {inv.station || "No station"}
                      </p>
                      {inv.email && (
                        <p className="mt-0.5 truncate text-xs" style={{ color: t.muted }}>
                          {inv.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-xl lg:shrink-0">
                    <InlineStat t={t} label="Cases" value={inv.totalCases ?? 0} />
                    <InlineStat t={t} label="Resolved" value={inv.resolvedCases ?? 0} tone="ok" />
                    <InlineStat
                      t={t}
                      label="Open"
                      value={invUnresolved}
                      tone={invUnresolved > 0 ? "danger" : "muted"}
                    />
                    <InlineStat t={t} label="Activities" value={activityCount} />
                  </div>
                </button>

                {isOpen && (
                  <div
                    id={`investigator-detail-${key}`}
                    className="space-y-5 border-t px-4 py-5 sm:px-5"
                    style={{ borderColor: t.border, backgroundColor: t.elevated }}
                  >
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <MiniDetailCard
                        t={t}
                        icon={CheckCircle2}
                        label="Resolved in period"
                        value={inv.resolvedInPeriod ?? 0}
                      />
                      <MiniDetailCard
                        t={t}
                        icon={LogIn}
                        label="Logged in (period)"
                        value={inv.loggedInInPeriod ? "Yes" : "No"}
                        tone={inv.loggedInInPeriod ? "ok" : "muted"}
                      />
                      <MiniDetailCard
                        t={t}
                        icon={Clock3}
                        label="Last login"
                        value={formatDateTimeShort(inv.lastLoginAt)}
                      />
                      <MiniDetailCard
                        t={t}
                        icon={LogOut}
                        label="Last logout"
                        value={formatDateTimeShort(inv.lastLogoutAt)}
                      />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <SessionPanel
                        t={t}
                        title="Login sessions"
                        icon={LogIn}
                        emptyLabel="No logins recorded in this period."
                        times={loginTimes}
                      />
                      <SessionPanel
                        t={t}
                        title="Logout sessions"
                        icon={LogOut}
                        emptyLabel="No logouts recorded in this period."
                        times={logoutTimes}
                      />
                    </div>

                    <div>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: t.muted }}>
                          Activity log
                        </p>
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums"
                          style={{ backgroundColor: t.brandSoft, color: t.brand }}
                        >
                          {activityCount} events
                        </span>
                      </div>
                      {activities.length === 0 ? (
                        <p
                          className="rounded-xl border px-4 py-5 text-sm"
                          style={{ borderColor: t.border, backgroundColor: t.card, color: t.muted }}
                        >
                          No activity recorded for this investigator in the selected period.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {activities.map((act, i) => (
                            <li
                              key={`${act.action}-${act.at}-${i}`}
                              className="relative rounded-xl border px-4 py-3 pl-5"
                              style={{ borderColor: t.border, backgroundColor: t.card }}
                            >
                              <span
                                className="absolute bottom-3 left-2 top-3 w-0.5 rounded-full"
                                style={{ backgroundColor: t.brandRing }}
                                aria-hidden="true"
                              />
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <span className="text-sm font-semibold" style={{ color: t.text }}>
                                  {formatActionLabel(act.action)}
                                </span>
                                <span
                                  className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums"
                                  style={{ backgroundColor: t.elevated, color: t.muted }}
                                >
                                  {formatDateTimeShort(act.at)}
                                </span>
                              </div>
                              {(act.description || act.resourceType || act.resourceId) && (
                                <p className="mt-1.5 break-words text-sm leading-relaxed" style={{ color: t.secondary }}>
                                  {act.description
                                    || [act.resourceType, act.resourceId].filter(Boolean).join(" · ")
                                    || "No resource"}
                                </p>
                              )}
                              {!act.description && act.details != null && act.details !== "" && (
                                <p className="mt-1.5 break-words text-xs leading-relaxed" style={{ color: t.muted }}>
                                  {typeof act.details === "string"
                                    ? act.details
                                    : JSON.stringify(act.details)}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActivityStatTile({ t, label, value, icon: Icon, tone = "primary" }) {
  const toneStyles = {
    primary: { bg: t.brandSoft, color: t.brand, value: t.text },
    ok: { bg: "rgba(6, 182, 212, 0.12)", color: "#06b6d4", value: "#06b6d4" },
    danger: { bg: t.dangerSoft, color: t.danger, value: t.danger },
    muted: { bg: t.elevated, color: t.muted, value: t.text },
  };
  const style = toneStyles[tone] || toneStyles.primary;

  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: t.border, backgroundColor: t.card }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: style.bg, color: style.color }}
        >
          <Icon size={14} />
        </span>
        <p className="text-[10px] font-bold uppercase leading-tight tracking-wide" style={{ color: t.muted }}>
          {label}
        </p>
      </div>
      <p className="text-2xl font-extrabold tabular-nums" style={{ color: style.value }}>
        {value}
      </p>
    </div>
  );
}

function StatusPill({ t, label, tone = "muted" }) {
  const isOk = tone === "ok";
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{
        backgroundColor: isOk ? "rgba(6, 182, 212, 0.12)" : t.elevated,
        color: isOk ? "#06b6d4" : t.muted,
        border: `1px solid ${isOk ? "rgba(6, 182, 212, 0.25)" : t.border}`,
      }}
    >
      {label}
    </span>
  );
}

function InlineStat({ t, label, value, tone = "default" }) {
  const valueColor =
    tone === "ok" ? "#06b6d4" : tone === "danger" ? t.danger : tone === "muted" ? t.muted : t.text;
  return (
    <div
      className="rounded-xl border px-3 py-2.5 text-center"
      style={{ borderColor: t.border, backgroundColor: t.elevated }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: t.muted }}>
        {label}
      </p>
      <p className="mt-1 text-lg font-extrabold tabular-nums" style={{ color: valueColor }}>
        {value}
      </p>
    </div>
  );
}

function MiniDetailCard({ t, icon: Icon, label, value, tone = "default" }) {
  const valueColor =
    tone === "ok" ? "#06b6d4" : tone === "muted" ? t.muted : t.text;
  return (
    <div
      className="flex items-start gap-3 rounded-xl border px-3 py-3"
      style={{ borderColor: t.border, backgroundColor: t.card }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: t.brandSoft, color: t.brand }}
      >
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: t.muted }}>
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-semibold tabular-nums" style={{ color: valueColor }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function SessionPanel({ t, title, icon: Icon, emptyLabel, times }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: t.border, backgroundColor: t.card }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ backgroundColor: t.brandSoft, color: t.brand }}
        >
          <Icon size={14} />
        </span>
        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: t.muted }}>
          {title}
        </p>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
          style={{ backgroundColor: t.elevated, color: t.secondary }}
        >
          {times.length}
        </span>
      </div>
      {times.length === 0 ? (
        <p className="text-sm" style={{ color: t.muted }}>{emptyLabel}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {times.map((at, i) => (
            <span
              key={`${title}-${i}`}
              className="inline-flex items-center rounded-lg border px-2.5 py-1.5 text-xs font-medium tabular-nums"
              style={{ borderColor: t.border, backgroundColor: t.elevated, color: t.text }}
            >
              {formatDateTime(at)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function CrimeCasesReport({ t, report }) {
  const stats = report.stats || {};
  const cases = report.cases || [];
  const statusBreakdown = report.statusBreakdown || [];

  const summaryCards = [
    { label: "Total Cases", value: stats.totalCases ?? 0, tone: "default" },
    { label: "Confirmed Crimes", value: stats.confirmedCrimes ?? 0, tone: "danger" },
    { label: "Under Investigation", value: stats.underInvestigation ?? 0, tone: "default" },
    { label: "False Positives", value: stats.falsePositives ?? 0, tone: "default" },
  ];

  const exportActions = [
    { label: "Export PDF", icon: FileText, action: exportReportPDF },
    { label: "Export Excel", icon: FileSpreadsheet, action: exportReportExcel },
    { label: "Export CSV", icon: Download, action: exportReportCSV },
  ];

  return (
    <div className="space-y-6">
      <div
        className="flex flex-col justify-between gap-4 rounded-2xl border p-5 sm:flex-row sm:items-start"
        style={{ backgroundColor: t.card, borderColor: t.border, boxShadow: t.shadow }}
      >
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Briefcase size={18} style={{ color: t.brand }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: t.muted }}>
              Crime report · {report.periodType || "period"}
            </span>
          </div>
          <h2 className="text-xl font-extrabold" style={{ color: t.text }}>{report.period}</h2>
          <p className="mt-1 text-sm" style={{ color: t.muted }}>
            Generated: {report.generatedAt ? new Date(report.generatedAt).toLocaleString() : "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {exportActions.map(({ label, icon: Icon, action }) => (
            <button
              key={label}
              type="button"
              onClick={() => action(report)}
              className="inline-flex h-[42px] items-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition hover:opacity-90"
              style={{ backgroundColor: t.brand }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {summaryCards.map(({ label, value, tone }) => (
          <StatCard key={label} t={t} label={label} value={value} tone={tone} />
        ))}
      </div>

      {(stats.resolved != null || stats.archived != null) && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <StatCard t={t} label="Resolved" value={stats.resolved ?? 0} />
          <StatCard t={t} label="Archived" value={stats.archived ?? 0} />
        </div>
      )}

      {statusBreakdown.length > 0 && (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ backgroundColor: t.card, borderColor: t.border, boxShadow: t.shadow }}
        >
          <div className="border-b px-5 py-3" style={{ borderColor: t.border }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: t.muted }}>
              Status breakdown
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: t.border }}>
            {statusBreakdown.map((row) => (
              <div
                key={row.status}
                className="flex items-center justify-between px-5 py-3 text-sm"
                style={{ borderColor: t.border }}
              >
                <span className="capitalize font-semibold" style={{ color: t.text }}>
                  {String(row.status || "unknown").replace(/_/g, " ")}
                </span>
                <span className="tabular-nums font-bold" style={{ color: t.brand }}>
                  {row.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="overflow-hidden rounded-2xl border"
        style={{ backgroundColor: t.card, borderColor: t.border, boxShadow: t.shadow }}
      >
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: t.border }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: t.muted }}>
            Cases in period
          </p>
          <span className="text-xs font-bold tabular-nums" style={{ color: t.secondary }}>
            {cases.length} shown
          </span>
        </div>
        {cases.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm" style={{ color: t.muted }}>
            No investigation cases found for this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr style={{ backgroundColor: t.elevated, color: t.muted }}>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Category</th>
                  <th className="px-4 py-3 font-bold">Officer</th>
                  <th className="px-4 py-3 font-bold">Source</th>
                  <th className="px-4 py-3 font-bold">Created</th>
                  <th className="px-4 py-3 font-bold">Content</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c._id} className="border-t" style={{ borderColor: t.border }}>
                    <td className="px-4 py-3 capitalize font-semibold" style={{ color: t.text }}>
                      {String(c.status || "—").replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 capitalize" style={{ color: t.secondary }}>
                      {c.category || "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: t.secondary }}>
                      {c.assignedOfficer?.name || "Unassigned"}
                    </td>
                    <td className="px-4 py-3 capitalize" style={{ color: t.secondary }}>
                      {c.history?.sourceType || "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: t.muted }}>
                      {formatDateTime(c.createdAt)}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3" style={{ color: t.secondary }} title={c.history?.content || ""}>
                      {c.history?.content || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ t, label, value, tone = "default" }) {
  const isDanger = tone === "danger";
  return (
    <div
      className="rounded-xl border px-3 py-2.5"
      style={{
        backgroundColor: t.card,
        borderColor: isDanger ? t.dangerSoft : t.border,
        boxShadow: t.shadow,
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: t.muted }}>
        {label}
      </p>
      <h2 className="mt-1 text-xl font-bold tabular-nums" style={{ color: isDanger ? t.danger : t.text }}>
        {value}
      </h2>
    </div>
  );
}

function ChartCard({ t, title, children }) {
  return (
    <div
      className="rounded-2xl border p-5"
      style={{ backgroundColor: t.card, borderColor: t.border, boxShadow: t.shadow }}
    >
      <h3
        className="mb-4 border-l-4 pl-3 text-sm font-bold"
        style={{ color: t.text, borderColor: t.brand }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function getBlacklistMatches(record) {
  const matches = record.blacklistMatches || [];
  return matches
    .map((match, index) => {
      const hrefCandidate = String(match.value || match.name || "").trim();
      const href = /^https?:\/\//i.test(hrefCandidate) ? hrefCandidate : null;
      const label = href || match.name || match.value || match.type || "blacklist";
      return { key: `${label}-${index}`, label, href };
    })
    .filter((item) => item.label);
}

function getPostUrl(record) {
  for (const value of [record.url, record.content]) {
    const text = String(value || "").trim();
    if (/^https?:\/\//i.test(text)) return text;
  }
  return null;
}

function BlacklistMatchChip({ t, match }) {
  const style = {
    borderColor: t.warnBorder,
    backgroundColor: t.warnSoft,
    color: t.warn,
  };
  const className =
    "inline-flex max-w-[220px] items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium";

  if (match.href) {
    return (
      <a href={match.href} target="_blank" rel="noopener noreferrer" className={`${className} hover:opacity-90`} style={style} title={match.href}>
        <ShieldAlert size={11} className="shrink-0" />
        <span className="truncate">{match.label}</span>
        <ExternalLink size={10} className="shrink-0 opacity-70" />
      </a>
    );
  }

  return (
    <span className={className} style={style} title={match.label}>
      <ShieldAlert size={11} className="shrink-0" />
      <span className="truncate">{match.label}</span>
    </span>
  );
}

function RecordsTable({ t, records }) {
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;
  const totalPages = Math.ceil(records.length / PER_PAGE);
  const visible = records.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ backgroundColor: t.card, borderColor: t.border, boxShadow: t.shadow }}
    >
      <div className="flex items-center gap-2 border-b px-5 py-4" style={{ borderColor: t.border }}>
        <Layers size={16} style={{ color: t.brand }} />
        <h3 className="text-sm font-bold" style={{ color: t.text }}>
          Records reviewed ({records.length})
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wider" style={{ borderColor: t.border, color: t.muted }}>
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Classification</th>
              <th className="px-4 py-3 text-left">Confidence</th>
              <th className="px-4 py-3 text-left">Related blacklist</th>
              <th className="px-4 py-3 text-left">Published</th>
              <th className="px-4 py-3 text-left">Report content</th>
              <th className="px-4 py-3 text-left">Link</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const postUrl = getPostUrl(r);
              const blacklistMatches = getBlacklistMatches(r);
              return (
                <tr key={r._id} className="border-b" style={{ borderColor: t.border }}>
                  <td className="px-4 py-3 text-xs" style={{ color: t.muted }}>
                    {r.sourceType || r.type || "-"}
                  </td>
                  <td className="px-4 py-3">
                    {r.isCrime ? (
                      <span className="flex items-center gap-1 text-xs font-bold" style={{ color: t.danger }}>
                        <AlertTriangle size={12} /> CRIME
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-bold" style={{ color: t.brand }}>
                        <ShieldCheck size={12} /> NO CRIME
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: t.secondary }}>
                    {r.confidence ?? 0}%
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {blacklistMatches.length > 0 ? (
                      <div className="flex max-w-[260px] flex-col gap-1.5">
                        {blacklistMatches.map((match) => (
                          <BlacklistMatchChip key={match.key} t={t} match={match} />
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: t.muted }}>—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs" style={{ color: t.muted }}>
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs" style={{ color: t.secondary }}>
                    {(r.content || "").slice(0, 80)}
                    {r.content?.length > 80 ? "…" : ""}
                  </td>
                  <td className="px-4 py-3">
                    {postUrl ? (
                      <a
                        href={postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-[280px] items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold hover:opacity-90"
                        style={{
                          borderColor: t.brandRing,
                          backgroundColor: t.brandSoft,
                          color: t.brand,
                        }}
                        title={postUrl}
                      >
                        <span className="truncate">{postUrl}</span>
                        <ExternalLink size={10} className="shrink-0" />
                      </a>
                    ) : (
                      <span style={{ color: t.muted }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div
          className="flex items-center justify-between border-t px-5 py-3 text-xs"
          style={{ borderColor: t.border, color: t.muted }}
        >
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg px-3 py-1.5 transition disabled:opacity-40"
              style={{ backgroundColor: t.elevated, color: t.text }}
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg px-3 py-1.5 transition disabled:opacity-40"
              style={{ backgroundColor: t.elevated, color: t.text }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
