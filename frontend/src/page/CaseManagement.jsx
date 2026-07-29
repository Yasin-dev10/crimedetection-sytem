import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Archive,
  Check,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  Flag,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  X,
  Hash,
  User,
  UserPlus,
  Activity,
  TrendingUp,
  FileText,
  Save,
  UserCheck,
  MessageSquarePlus,
} from "lucide-react";
import API from "../api";
import { getStoredUser } from "../theme";
import { exportInvestigationCasePDF } from "../utils/investigationReport";
import { renderCrimeHighlightedText } from "../utils/crimeHighlight";

const ACTIVE_STATUSES = new Set(["pending", "investigating"]);

const FLAG_STATUSES = new Set([
  "false_report",
  "misleading_information",
  "malicious_report",
]);

const ACCOUNT_ACTION_OPTIONS = [
  { value: "", label: "Use policy suggestion" },
  { value: "warning", label: "Warning (1 flag)" },
  { value: "under_review", label: "Under review (2 flags)" },
  { value: "suspended", label: "Temporary suspension (3+ flags)" },
  { value: "blocked", label: "Account blocked (5+ flags)" },
  { value: "none", label: "Confirm flag only (no sanction)" },
];

const VIEW_FILTER_GROUPS = [
  {
    label: "Overview",
    options: [
      { value: "active", label: "Active Cases" },
      { value: "assigned", label: "Assigned (Open)" },
      { value: "resolved", label: "Case Resolution" },
      { value: "all", label: "All Cases" },
    ],
  },
  {
    label: "By status",
    options: [
      { value: "pending", label: "Pending" },
      { value: "investigating", label: "Investigating" },
      { value: "crime_case", label: "Crime Case / Verified" },
      { value: "not_crime", label: "Not Crime" },
      { value: "false_report", label: "Flagged: False Report" },
      { value: "archived", label: "Archived" },
    ],
  },
  {
    label: "Reports",
    options: [
      { value: "my_reports", label: "My Reports" },
      { value: "all_reports", label: "All Reports", adminOnly: true },
    ],
  },
];

const VIEW_FILTER_LABELS = Object.fromEntries(
  VIEW_FILTER_GROUPS.flatMap((group) =>
    group.options.map((opt) => [opt.value, opt.label])
  )
);

const getSortedOfficers = (officers) =>
  [...officers].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );

const statusStyles = {
  pending: {
    bg: "rgba(245, 158, 11, 0.12)",
    color: "#d97706",
    border: "rgba(245, 158, 11, 0.35)",
  },
  investigating: {
    bg: "rgba(30, 58, 138, 0.12)",
    color: "#1E3A8A",
    border: "rgba(30, 58, 138, 0.3)",
  },
  crime_case: {
    bg: "rgba(239, 68, 68, 0.12)",
    color: "#dc2626",
    border: "rgba(239, 68, 68, 0.3)",
  },
  not_crime: {
    bg: "rgba(16, 185, 129, 0.12)",
    color: "#059669",
    border: "rgba(16, 185, 129, 0.3)",
  },
  false_report: {
    bg: "rgba(249, 115, 22, 0.12)",
    color: "#ea580c",
    border: "rgba(249, 115, 22, 0.3)",
  },
  misleading_information: {
    bg: "rgba(202, 138, 4, 0.12)",
    color: "#a16207",
    border: "rgba(202, 138, 4, 0.3)",
  },
  malicious_report: {
    bg: "rgba(225, 29, 72, 0.12)",
    color: "#e11d48",
    border: "rgba(225, 29, 72, 0.3)",
  },
  resolved: {
    bg: "rgba(16, 185, 129, 0.12)",
    color: "#059669",
    border: "rgba(16, 185, 129, 0.3)",
  },
  archived: {
    bg: "rgba(100, 116, 139, 0.12)",
    color: "#64748b",
    border: "rgba(100, 116, 139, 0.3)",
  },
};

export default function CaseManagement() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getStoredUser();
  const isAdmin = user?.role === "admin";
  const isInvestigator = user?.role === "investigator";
  const [cases, setCases] = useState([]);
  const [officers, setOfficers] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [viewFilter, setViewFilter] = useState("active");
  const [noteText, setNoteText] = useState("");
  const [investigationReports, setInvestigationReports] = useState([]);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const claimingRef = useRef(new Set());
  const currentUserId = String(user?.id || user?._id || "");

  const isReportsView = viewFilter === "my_reports" || viewFilter === "all_reports";

  const claimCaseIfNeeded = async (item) => {
    if (
      !isInvestigator ||
      !item?._id ||
      item.assignedOfficer ||
      item.status !== "pending"
    ) {
      return { case: item, claimed: false };
    }

    if (claimingRef.current.has(item._id)) {
      return { case: null, claimed: false, busy: true };
    }

    claimingRef.current.add(item._id);
    try {
      const res = await API.post(`/investigation/cases/${item._id}/accept`);
      const claimed = res.data?.case || item;
      setCases((prev) => [claimed, ...prev.filter((c) => c._id !== item._id)]);
      setSuccess(
        res.data?.alreadyMine
          ? "Case already assigned to you."
          : "You opened this case first — it is now assigned to you. Other investigators were removed."
      );
      window.dispatchEvent(new Event("notifications:read"));
      return { case: claimed, claimed: true, alreadyMine: res.data?.alreadyMine };
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        "This case was already claimed by another investigator";
      setError(msg);
      await loadData();
      return { case: null, claimed: false, error: msg };
    } finally {
      claimingRef.current.delete(item._id);
    }
  };

  const openCase = async (item) => {
    if (!item?._id) return;

    setError("");
    const result = await claimCaseIfNeeded(item);
    if (result.busy) return;
    if (result.error || !result.case) return;

    setSelectedCase(result.case);
    setNoteText("");
    navigate(`/cases?case=${result.case._id}`, { replace: true });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const requests = isAdmin
        ? [
            API.get("/investigation/cases?status=all"),
            API.get("/investigation/officers"),
            API.get("/investigation/reports"),
          ]
        : [
            API.get("/investigation/cases?status=all"),
            Promise.resolve({ data: [] }),
            API.get("/investigation/reports"),
          ];

      const [casesRes, officersRes, reportsRes] = await Promise.all(requests);

      setCases(Array.isArray(casesRes.data) ? casesRes.data : []);
      setOfficers(Array.isArray(officersRes.data) ? officersRes.data : []);
      setInvestigationReports(Array.isArray(reportsRes.data) ? reportsRes.data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load case management data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  useEffect(() => {
    const caseId = new URLSearchParams(location.search).get("case");
    if (!caseId || loading) return;

    const match = cases.find((item) => item._id === caseId);
    if (!match) return;

    let cancelled = false;

    const syncSelected = async () => {
      // Deep-link / notification open also claims for investigators
      if (
        isInvestigator &&
        !match.assignedOfficer &&
        match.status === "pending"
      ) {
        const result = await claimCaseIfNeeded(match);
        if (cancelled || result.busy) return;
        if (result.case) {
          setSelectedCase(result.case);
          setNoteText("");
        }
        return;
      }

      setSelectedCase(match);
      setNoteText("");
    };

    syncSelected();
    return () => {
      cancelled = true;
    };
  }, [location.search, cases, loading, isInvestigator]);

  const isResolvedStatus = (status) =>
    status === "crime_case" ||
    status === "not_crime" ||
    status === "false_report" ||
    status === "misleading_information" ||
    status === "malicious_report" ||
    status === "resolved";

  const visibleCases = useMemo(() => {
    if (viewFilter === "all") return cases;
    if (viewFilter === "assigned") {
      // Open work only: officer assigned and not yet resolved
      return cases.filter(
        (item) => Boolean(item.assignedOfficer) && ACTIVE_STATUSES.has(item.status)
      );
    }
    if (viewFilter === "active") {
      return cases.filter((item) => ACTIVE_STATUSES.has(item.status));
    }
    if (viewFilter === "resolved") {
      return cases.filter((item) => isResolvedStatus(item.status));
    }
    return cases.filter((item) => item.status === viewFilter);
  }, [cases, viewFilter]);

  const visibleReports = useMemo(() => {
    // API already scopes investigators to own reports; admin sees all.
    return investigationReports;
  }, [investigationReports]);

  const totals = useMemo(
    () => ({
      // Currently assigned & still open (excludes resolved)
      assigned: cases.filter(
        (item) => Boolean(item.assignedOfficer) && ACTIVE_STATUSES.has(item.status)
      ).length,
      // Pending + investigating (with or without officer)
      active: cases.filter((item) => ACTIVE_STATUSES.has(item.status)).length,
      investigating: cases.filter((item) => item.status === "investigating").length,
      resolved: cases.filter((item) => isResolvedStatus(item.status)).length,
      myReports: investigationReports.filter(
        (r) => String(r.investigator?._id || r.investigator) === currentUserId
      ).length,
      allReports: investigationReports.length,
    }),
    [cases, investigationReports, currentUserId]
  );

  const updateCase = async (id, updates) => {
    try {
      setError("");
      setSuccess("");
      const res = await API.patch(`/investigation/cases/${id}`, updates);
      const updated = res.data.case;
      setCases((prev) => {
        const withoutOld = prev.filter((item) => item._id !== id);
        return [updated, ...withoutOld];
      });
      setSelectedCase((prev) => (prev?._id === id ? updated : prev));

      if (updates.assignedOfficer) {
        setSuccess("Officer assigned. Investigators were notified.");
      } else if (updates.findings !== undefined) {
        setSuccess("Investigation findings saved.");
      } else if (updates.status || typeof updates.isCrime === "boolean") {
        setSuccess("Case status updated.");
      }

      return true;
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to update case"
      );
      return false;
    }
  };

  const addNote = async (e) => {
    e?.preventDefault?.();
    if (!selectedCase || !noteText.trim()) return;

    try {
      setError("");
      setSuccess("");
      const res = await API.post(`/investigation/cases/${selectedCase._id}/notes`, {
        text: noteText.trim(),
      });
      const updated = res.data.case;
      setNoteText("");
      setCases((prev) =>
        prev.map((item) => (item._id === selectedCase._id ? updated : item))
      );
      setSelectedCase(updated);
      setSuccess("Investigation note saved.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add note");
    }
  };

  const classifyCase = async (id, isCrime) => {
    const label = isCrime ? "Crime Case" : "Not Crime";
    if (!window.confirm(`Resolve this case as ${label}?`)) return;
    await updateCase(id, { isCrime });
  };

  const flagCase = async (id, { flagType, reason }) => {
    try {
      setError("");
      setSuccess("");
      const res = await API.post(`/investigation/cases/${id}/flag`, {
        flagType,
        reason,
      });
      const updated = res.data.case;
      setCases((prev) => {
        const withoutOld = prev.filter((item) => item._id !== id);
        return [updated, ...withoutOld];
      });
      setSelectedCase((prev) => (prev?._id === id ? updated : prev));
      setSuccess(
        res.data.message ||
          "False report flag applied automatically."
      );
      return true;
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to flag report"
      );
      return false;
    }
  };

  const reviewFlag = async (id, payload) => {
    try {
      setError("");
      setSuccess("");
      const res = await API.post(`/investigation/cases/${id}/flag/review`, payload);
      const updated = res.data.case;
      setCases((prev) => {
        const withoutOld = prev.filter((item) => item._id !== id);
        return [updated, ...withoutOld];
      });
      setSelectedCase((prev) => (prev?._id === id ? updated : prev));
      setSuccess(res.data.message || "Flag review saved.");
      return true;
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          "Failed to review flag"
      );
      return false;
    }
  };

  const updateStatus = async (id, status) => {
    const labels = {
      investigating: "Investigating",
      archived: "Archived",
      pending: "Pending",
    };
    if (!window.confirm(`Set case status to ${labels[status] || status}?`)) return;
    await updateCase(id, { status });
  };

  const closeCaseDetails = () => {
    setSelectedCase(null);
    setNoteText("");
    const params = new URLSearchParams(location.search);
    if (!params.has("case")) return;

    params.delete("case");
    const search = params.toString();
    navigate(
      { pathname: location.pathname, search: search ? `?${search}` : "" },
      { replace: true }
    );
  };

  const deleteCase = async (id) => {
    if (!window.confirm("Delete this case permanently?")) return;

    try {
      setError("");
      await API.delete(`/investigation/cases/${id}`);
      setCases((prev) => prev.filter((item) => item._id !== id));
      if (selectedCase?._id === id) closeCaseDetails();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete case");
    }
  };

  const sectionTitle =
    {
      active: "Active Cases",
      assigned: "Assigned (Open)",
      resolved: "Case Resolution",
      all: "All Cases",
      pending: "Pending Cases",
      investigating: "Investigating Cases",
      crime_case: "Crime Cases",
      not_crime: "Not Crime Cases",
      false_report: "Flagged — False Reports",
      misleading_information: "Flagged — Misleading Information",
      malicious_report: "Flagged — Malicious Reports",
      archived: "Archived Cases",
      my_reports: "My Investigation Reports",
      all_reports: "All Investigation Reports",
    }[viewFilter] || "Cases";

  const emptyViewHint =
    {
      false_report:
        "Weli ma jiraan cases False Report loo calaamadeeyay. Tag Active Cases → fur case → Status Updates & Resolution → Mark as False Report.",
      assigned: isInvestigator
        ? "No open assigned cases right now."
        : "No open assigned cases in this view.",
      active: isInvestigator
        ? "No cases in this view. Available crime cases and your open assigned work appear here."
        : "No cases found in this view.",
    }[viewFilter] ||
    (isInvestigator
      ? "No cases in this view. Available crime cases and your open assigned work appear here."
      : "No cases found in this view.");

  const openReportCase = (report) => {
    const caseItem = report.case;
    if (!caseItem?._id) {
      setError("Linked case is missing for this report.");
      return;
    }
    // Prefer fresh case from cases list if available
    const match = cases.find((c) => c._id === caseItem._id) || caseItem;
    openCase(match);
  };

  const removeLocalReport = (reportId) => {
    setInvestigationReports((prev) =>
      prev.filter((r) => (r._id || r.id) !== reportId)
    );
  };

  return (
    <div
      className="w-full transition-colors duration-300"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h1 className="mt-1 text-3xl font-bold">Case Management</h1>
            <p className="mt-2 max-w-2xl text-sm" style={{ color: "var(--text-muted)" }}>
              {isInvestigator
                ? "When AI detects a crime, available cases appear here for every investigator. Open a case first to claim it — others are removed automatically."
                : "Assigned cases, active investigations, notes, status updates, and case resolution in one workspace. AI crime cases are broadcast to all investigators."}
            </p>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            {success && <p className="mt-2 text-sm text-emerald-400">{success}</p>}
          </div>

          <ViewFilterDropdown
            value={viewFilter}
            onChange={setViewFilter}
            isAdmin={isAdmin}
          />
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Metric
            title="Assigned (Open)"
            value={totals.assigned}
            icon={UserCheck}
            active={viewFilter === "assigned"}
            onClick={() => setViewFilter("assigned")}
          />
          <Metric
            title="Active Cases"
            value={totals.active}
            icon={Activity}
            active={viewFilter === "active"}
            onClick={() => setViewFilter("active")}
          />
          <Metric
            title={isAdmin ? "All Reports" : "My Reports"}
            value={isAdmin ? totals.allReports : totals.myReports}
            icon={FileText}
            active={viewFilter === (isAdmin ? "all_reports" : "my_reports")}
            onClick={() => setViewFilter(isAdmin ? "all_reports" : "my_reports")}
          />
          <Metric
            title="Resolved"
            value={totals.resolved}
            icon={ShieldCheck}
            active={viewFilter === "resolved"}
            onClick={() => setViewFilter("resolved")}
          />
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading case management...
          </p>
        ) : isReportsView ? (
          <section
            className="rounded-2xl border p-5"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-base)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <h2
              className="mb-4 flex items-center gap-2 text-lg font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              <ClipboardList size={20} style={{ color: "var(--brand)" }} />
              {sectionTitle}
            </h2>
            <p className="mb-4 text-sm" style={{ color: "var(--text-muted)" }}>
              {isAdmin && viewFilter === "all_reports"
                ? "Admin view — all investigation reports across investigators."
                : "You only see investigation reports you authored."}
            </p>
            {visibleReports.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No investigation reports yet. Open an assigned case and create a report.
              </p>
            ) : (
              <div className="space-y-3">
                {visibleReports.map((report) => (
                  <InvestigationReportRow
                    key={report._id || report.id}
                    report={report}
                    isAdmin={isAdmin}
                    currentUserId={currentUserId}
                    onOpen={() => openReportCase(report)}
                    onExport={() => {
                      const caseItem = report.case;
                      if (!caseItem) return;
                      exportInvestigationCasePDF(caseItem, report);
                    }}
                    onDelete={async () => {
                      if (!isAdmin) return;
                      if (!window.confirm("Delete this investigation report?")) return;
                      try {
                        await API.delete(`/investigation/reports/${report._id || report.id}`);
                        removeLocalReport(report._id || report.id);
                        setSuccess("Investigation report deleted.");
                      } catch (err) {
                        setError(err.response?.data?.message || "Failed to delete report");
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        ) : (
          <section
            className="rounded-2xl border p-5"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-base)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <h2
              className="mb-4 flex items-center gap-2 text-lg font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              <ClipboardList size={20} style={{ color: "var(--brand)" }} />
              {sectionTitle}
            </h2>

            {visibleCases.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {emptyViewHint}
                </p>
                {FLAG_STATUSES.has(viewFilter) && (
                  <button
                    type="button"
                    onClick={() => setViewFilter("active")}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition hover:opacity-90"
                    style={{
                      backgroundColor: "var(--brand-soft)",
                      borderColor: "var(--brand-ring)",
                      color: "var(--brand)",
                    }}
                  >
                    Go to Active Cases
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {visibleCases.map((item) => (
                  <CaseRow
                    key={item._id}
                    item={item}
                    isAdmin={isAdmin}
                    isInvestigator={isInvestigator}
                    onView={() => openCase(item)}
                    onAssign={() => openCase(item)}
                    onDelete={() => deleteCase(item._id)}
                    onClassify={(isCrime) => classifyCase(item._id, isCrime)}
                    onStatus={(status) => updateStatus(item._id, status)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {selectedCase && (
          <CaseDetails
            item={selectedCase}
            officers={officers}
            isAdmin={isAdmin}
            isInvestigator={isInvestigator}
            noteText={noteText}
            setNoteText={setNoteText}
            onClose={closeCaseDetails}
            onSaveAssignment={async (updates) => {
              const saved = await updateCase(selectedCase._id, updates);
              if (saved) closeCaseDetails();
            }}
            onClassify={(isCrime) => classifyCase(selectedCase._id, isCrime)}
            onStatus={(status) => updateStatus(selectedCase._id, status)}
            onFlag={(payload) => flagCase(selectedCase._id, payload)}
            onReviewFlag={(payload) => reviewFlag(selectedCase._id, payload)}
            onAddNote={addNote}
          />
        )}
      </div>
    </div>
  );
}

function ViewFilterDropdown({ value, onChange, isAdmin }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const label = VIEW_FILTER_LABELS[value] || "Filter cases";

  return (
    <div ref={rootRef} className="relative z-30 w-full sm:w-72">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left text-sm font-semibold transition hover:opacity-95"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: open ? "var(--brand-ring)" : "var(--border-base)",
          color: "var(--text-primary)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          style={{ color: "var(--text-muted)" }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Case view filter"
          className="absolute right-0 z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border py-2 shadow-xl"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-base)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {VIEW_FILTER_GROUPS.map((group) => {
            const options = group.options.filter(
              (opt) => !opt.adminOnly || isAdmin
            );
            if (options.length === 0) return null;

            return (
              <div key={group.label} className="py-1">
                <p
                  className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  {group.label}
                </p>
                {options.map((opt) => {
                  const selected = value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:opacity-90"
                      style={{
                        backgroundColor: selected
                          ? "var(--brand-soft)"
                          : "transparent",
                        color: selected
                          ? "var(--brand)"
                          : "var(--text-primary)",
                      }}
                    >
                      <span className="font-medium">{opt.label}</span>
                      {selected && <Check size={15} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ title, value, icon: Icon, active = false, onClick }) {
  const interactive = typeof onClick === "function";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={`w-full rounded-2xl border p-5 text-left transition ${
        interactive ? "cursor-pointer hover:opacity-95" : "cursor-default"
      }`}
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: active ? "var(--brand-ring)" : "var(--border-base)",
        boxShadow: "var(--shadow-card)",
        outline: active ? "2px solid var(--brand-soft)" : "none",
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {title}
          </p>
          <h2
            className="mt-2 text-3xl font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {value}
          </h2>
        </div>
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{
            backgroundColor: "var(--brand-soft)",
            color: "var(--brand)",
          }}
        >
          <Icon size={22} />
        </div>
      </div>
    </button>
  );
}

function OfficerAssignmentPanel({
  officers,
  selectedOfficerId,
  savedOfficerId,
  onSelectOfficer,
  onSave,
  compact = false,
}) {
  const matchingOfficers = getSortedOfficers(officers);
  const savedOfficer = officers.find((o) => o._id === savedOfficerId);
  const hasChanges = (selectedOfficerId || "") !== (savedOfficerId || "");
  const canSave = hasChanges && selectedOfficerId;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {savedOfficer && (
        <div
          className={`flex items-center gap-2 text-slate-400 ${
            compact ? "text-[10px]" : "text-xs"
          }`}
        >
          <User size={compact ? 11 : 13} />
          <span>
            Currently:{" "}
            <span className="font-semibold text-slate-200">
              Det. {savedOfficer.name}
            </span>
          </span>
        </div>
      )}

      {matchingOfficers.length === 0 ? (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
          No investigators available.
        </div>
      ) : (
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
              Investigators
            </p>
            <span className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-bold text-cyan-200">
              {matchingOfficers.length}
            </span>
          </div>

          <div className={compact ? "space-y-1.5" : "grid gap-2 sm:grid-cols-2"}>
            {matchingOfficers.map((officer) => {
              const isSelected = selectedOfficerId === officer._id;
              const isSaved = savedOfficerId === officer._id;

              return (
                <button
                  key={officer._id}
                  type="button"
                  onClick={() => onSelectOfficer(officer._id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                      : "border-slate-700/70 bg-slate-950/70 text-slate-200 hover:border-cyan-500/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold">
                      {officer.name || "Unnamed investigator"}
                    </span>
                    {isSelected && (
                      <span className="shrink-0 rounded-md bg-cyan-400 px-1.5 py-0.5 text-[10px] font-black text-slate-950">
                        {isSaved ? "Saved" : "Selected"}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 truncate text-[11px] text-slate-500">
                    {officer.badgeNumber ||
                      officer.email ||
                      officer.station ||
                      "Investigator"}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onSave}
        disabled={!canSave}
        className={`flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 font-extrabold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40 ${
          compact ? "py-2 text-xs" : "py-2.5 text-sm"
        }`}
      >
        <Save size={compact ? 14 : 16} />
        Save
      </button>
    </div>
  );
}

function CaseRow({
  item,
  isAdmin,
  isInvestigator,
  onView,
  onAssign,
  onDelete,
  onClassify,
  onStatus,
}) {
  const history = item.history || {};
  const canWorkCase =
    (isAdmin || (isInvestigator && item.assignedOfficer)) &&
    item.status !== "crime_case" &&
    item.status !== "not_crime" &&
    !FLAG_STATUSES.has(item.status) &&
    item.status !== "archived";
  const isCaseClosed =
    item.status === "crime_case" ||
    item.status === "not_crime" ||
    FLAG_STATUSES.has(item.status) ||
    item.status === "resolved" ||
    item.status === "archived" ||
    item.archived === true;
  const badge = statusStyles[item.status] || statusStyles.pending;

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border-base)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Header: status + date only */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <span
          className="inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
          style={{
            backgroundColor: badge.bg,
            color: badge.color,
            borderColor: badge.border,
          }}
        >
          {formatStatus(item.status)}
        </span>
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
          {formatDate(history.createdAt || item.createdAt)}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3.5">
        <h3
          className="text-base font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {(history.sourceType || history.type || "record").toUpperCase()}{" "}
          Investigation Case
        </h3>

        <p
          className="mt-2 line-clamp-2 text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {history.isCrime || item.status === "crime_case"
            ? renderCrimeHighlightedText(history.content || "", true, {
                matchedKeyword: history.matchedKeyword,
                blacklistMatches: history.blacklistMatches,
              })
            : history.content || "No content"}
        </p>

        <p className="mt-2.5 text-xs" style={{ color: "var(--text-muted)" }}>
          Officer:{" "}
          {item.assignedOfficer?.name ||
            (item.status === "pending"
              ? "Available — open to claim"
              : "Not assigned")}
          {" · "}
          Notes: {item.notes?.length || 0}
        </p>
      </div>

      {/* Actions: separate row, consistent style */}
      <div
        className="flex flex-wrap gap-2 border-t px-4 py-3"
        style={{
          borderColor: "var(--border-soft)",
          backgroundColor: "var(--bg-surface)",
        }}
      >
        {isAdmin && !isCaseClosed && (
          <CaseActionButton
            icon={UserPlus}
            label="Assign"
            onClick={onAssign}
            tone="primary"
          />
        )}
        {canWorkCase && item.status === "pending" && (
          <CaseActionButton
            icon={Activity}
            label="Start"
            onClick={() => onStatus("investigating")}
            tone="primary"
          />
        )}
        {canWorkCase && (
          <>
            <CaseActionButton
              icon={ShieldAlert}
              label="Crime"
              onClick={() => onClassify(true)}
              tone="danger"
            />
            <CaseActionButton
              icon={ShieldCheck}
              label="Not Crime"
              onClick={() => onClassify(false)}
              tone="success"
            />
          </>
        )}
        <CaseActionButton icon={Eye} label="View" onClick={onView} tone="neutral" />
        {isAdmin && (
          <CaseActionButton
            icon={Trash2}
            label="Delete"
            onClick={onDelete}
            tone="danger"
          />
        )}
      </div>
    </div>
  );
}

function CaseDetails({
  item,
  officers,
  isAdmin,
  isInvestigator,
  noteText,
  setNoteText,
  onClose,
  onSaveAssignment,
  onClassify,
  onStatus,
  onFlag,
  onReviewFlag,
  onAddNote,
}) {
  const history = item.history || {};
  const confidence = history.confidence || 0;
  const isCrime = history.isCrime;
  const savedOfficerId = item.assignedOfficer?._id || "";
  const [pendingOfficerId, setPendingOfficerId] = useState(savedOfficerId);
  const [flagReason, setFlagReason] = useState("");
  const [flagChecked, setFlagChecked] = useState(false);
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [adminAction, setAdminAction] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const isCaseResolved =
    item.status === "crime_case" ||
    item.status === "not_crime" ||
    FLAG_STATUSES.has(item.status) ||
    item.status === "resolved";

  const canWorkCase =
    !isCaseResolved &&
    item.status !== "archived" &&
    (isAdmin || (isInvestigator && Boolean(item.assignedOfficer)));
  const canAddNotes =
    isAdmin ||
    (isInvestigator &&
      item.assignedOfficer &&
      item.status !== "archived");

  const reportingUser = history.user || item.reportFlag?.reportingUser || null;
  const hasCitizenReporter =
    reportingUser &&
    (reportingUser.role === "user" || !reportingUser.role);
  const canFlagReport =
    canWorkCase && item.reportFlag?.reviewStatus !== "pending";
  const pendingFlag = item.reportFlag?.reviewStatus === "pending";

  useEffect(() => {
    setPendingOfficerId(item.assignedOfficer?._id || "");
    setFlagReason("");
    setFlagChecked(false);
    setAdminAction("");
    setAdminNotes("");
  }, [item._id, item.assignedOfficer?._id]);

  const handleSave = async () => {
    const updates = {};
    if (pendingOfficerId && pendingOfficerId !== savedOfficerId) {
      updates.assignedOfficer = pendingOfficerId;
    }
    if (Object.keys(updates).length > 0) {
      await onSaveAssignment(updates);
    }
  };

  const handleFlagSubmit = async () => {
    if (!flagChecked) {
      window.alert("Please check the False Report box first.");
      return;
    }
    if (!flagReason.trim() || flagReason.trim().length < 5) {
      window.alert("Please enter a reason (at least 5 characters).");
      return;
    }
    const userNote = hasCitizenReporter
      ? "Flag count and account sanction (warning / under review / suspension / block) will be applied automatically by policy."
      : "No citizen account is linked (e.g. Facebook/website scan). The case will be marked, but no user will be sanctioned.";
    if (
      !window.confirm(`Mark this report as False Report?\n\n${userNote}`)
    ) {
      return;
    }
    setFlagSubmitting(true);
    try {
      await onFlag({ flagType: "false_report", reason: flagReason.trim() });
    } finally {
      setFlagSubmitting(false);
    }
  };

  const handleReview = async (decision) => {
    const label = decision === "confirm" ? "confirm" : "reject";
    if (
      !window.confirm(
        decision === "confirm"
          ? "Confirm this flag and apply the selected account action?"
          : "Reject this flag and roll back the reporter's flag count?"
      )
    ) {
      return;
    }
    setReviewSubmitting(true);
    try {
      await onReviewFlag({
        decision: label,
        adminAction: decision === "confirm" ? adminAction || undefined : "none",
        adminNotes: adminNotes.trim(),
      });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const decisionStatus =
    {
      pending: {
        label: "Pending Review",
        badge: "Pending",
        badgeColor: "bg-amber-500 text-slate-950",
      },
      investigating: {
        label: "Under Investigation",
        badge: "Active",
        badgeColor: "bg-cyan-500 text-slate-950",
      },
      crime_case: {
        label: "Verified — Crime Case",
        badge: "Verified",
        badgeColor: "bg-red-500 text-white",
      },
      not_crime: {
        label: "Dismissed — Not Crime",
        badge: "Closed",
        badgeColor: "bg-slate-500 text-white",
      },
      false_report: {
        label: "False Report",
        badge: "False",
        badgeColor: "bg-orange-500 text-slate-950",
      },
      misleading_information: {
        label: "Misleading Information",
        badge: "Misleading",
        badgeColor: "bg-yellow-500 text-slate-950",
      },
      malicious_report: {
        label: "Malicious Report",
        badge: "Malicious",
        badgeColor: "bg-rose-600 text-white",
      },
      resolved: {
        label: "Resolved",
        badge: "Resolved",
        badgeColor: "bg-emerald-500 text-slate-950",
      },
      archived: {
        label: "Archived",
        badge: "Archived",
        badgeColor: "bg-slate-600 text-white",
      },
    }[item.status] || {
      label: "Pending Review",
      badge: "Pending",
      badgeColor: "bg-amber-500 text-slate-950",
    };

  const caseId = item._id
    ? `${new Date(item.createdAt).toISOString().slice(0, 10)}-${item._id
        .slice(-3)
        .toUpperCase()}`
    : "N/A";

  const sourceLabel = [
    history.sourceType || history.type,
    history.pageName,
    history.authorName,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-700/60 shadow-2xl"
        style={{ backgroundColor: "var(--bg-surface)" }}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-7 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Case Management
            </p>
            <h2 className="mt-0.5 text-xl font-bold text-white">
              Investigation Workspace
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 p-7 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <div
              className="rounded-xl border border-slate-800 p-5"
              style={{ backgroundColor: "var(--bg-card)" }}
            >
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Prediction
              </p>
              {isCrime ? (
                <div className="flex items-center gap-2 text-base font-bold text-rose-400">
                  <AlertTriangle size={18} className="shrink-0" />
                  Criminal Intent Detected
                </div>
              ) : (
                <div className="flex items-center gap-2 text-base font-bold text-emerald-400">
                  <ShieldCheck size={18} className="shrink-0" />
                  No Criminal Intent
                </div>
              )}
            </div>

            <div
              className="rounded-xl border border-slate-800 p-5"
              style={{ backgroundColor: "var(--bg-card)" }}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <TrendingUp size={12} />
                  Confidence Level
                </p>
                <span className="text-lg font-extrabold text-white">
                  {confidence}%
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    confidence >= 75
                      ? "progress-bar progress-bar--high"
                      : confidence >= 50
                      ? "progress-bar progress-bar--mid"
                      : "progress-bar progress-bar--low"
                  }`}
                  style={{ width: `${confidence}%` }}
                />
              </div>
            </div>

            <div
              className="rounded-xl border border-slate-800 p-5"
              style={{ backgroundColor: "var(--bg-card)" }}
            >
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Current Decision Status
              </p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-amber-300">
                  {decisionStatus.label}
                </span>
                <span
                  className={`rounded-lg px-3 py-1 text-[11px] font-extrabold ${decisionStatus.badgeColor}`}
                >
                  {decisionStatus.badge}
                </span>
              </div>
            </div>

            <div
              className="rounded-xl border border-slate-800 p-5"
              style={{ backgroundColor: "var(--bg-card)" }}
            >
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Case Status
              </p>
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-slate-400" />
                <span className="text-sm font-medium text-slate-200">
                  {formatStatus(item.status)}
                </span>
              </div>
              {(item.investigationStartedAt || item.assignedAt) && (
                <p className="mt-2 text-xs text-slate-500">
                  Investigation started:{" "}
                  {formatDate(item.investigationStartedAt || item.assignedAt)}
                </p>
              )}
              {item.resolvedAt && (
                <p className="mt-1 text-xs text-slate-500">
                  Resolved: {formatDate(item.resolvedAt)}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#111827] p-5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Assignment
              </p>
              {isAdmin && !isCaseResolved && item.status !== "archived" ? (
                <OfficerAssignmentPanel
                  officers={officers}
                  selectedOfficerId={pendingOfficerId}
                  savedOfficerId={savedOfficerId}
                  onSelectOfficer={setPendingOfficerId}
                  onSave={handleSave}
                />
              ) : (
                <div className="mt-1 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <User size={14} className="text-slate-400" />
                    {item.assignedOfficer
                      ? `Det. ${item.assignedOfficer.name}`
                      : "Not Assigned"}
                  </div>
                  {(isCaseResolved || item.status === "archived") && (
                    <p className="text-xs text-slate-500">
                      Case closed — cannot be reassigned.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#111827] px-5 py-4">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Case ID
              </p>
              <div className="flex items-center gap-2">
                <Hash size={13} className="text-slate-500" />
                <span className="font-mono text-sm font-bold text-slate-200">
                  {caseId}
                </span>
              </div>
              {sourceLabel && (
                <p className="mt-2 break-all text-xs text-slate-500">
                  Source: {sourceLabel}
                </p>
              )}
              {history.url && (
                <a
                  href={history.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block break-all text-xs font-semibold text-cyan-400 hover:underline"
                >
                  {history.url}
                </a>
              )}
            </div>

            {(isInvestigator || isAdmin) && (
              <div
                className="rounded-xl border border-slate-800 p-5"
                style={{ backgroundColor: "var(--bg-card)" }}
              >
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Status Updates & Resolution
                </p>

                {isCaseResolved ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {item.status === "crime_case" ? (
                        <>
                          <ShieldAlert size={18} className="shrink-0 text-red-400" />
                          <span className="text-sm font-bold text-red-300">
                            Verified — Crime Confirmed
                          </span>
                        </>
                      ) : FLAG_STATUSES.has(item.status) ? (
                        <>
                          <Flag size={18} className="shrink-0 text-orange-400" />
                          <span className="text-sm font-bold text-orange-300">
                            {formatStatus(item.status)}
                            {item.reportFlag?.reviewStatus === "pending"
                              ? " — Pending admin review (legacy)"
                              : item.reportFlag?.reviewStatus === "confirmed"
                              ? item.reportFlag?.adminAction &&
                                item.reportFlag.adminAction !== "none"
                                ? ` — Applied (${item.reportFlag.adminAction})`
                                : " — Applied"
                              : item.reportFlag?.reviewStatus === "rejected"
                              ? " — Rejected"
                              : ""}
                          </span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={18} className="shrink-0 text-emerald-400" />
                          <span className="text-sm font-bold text-emerald-300">
                            Not Crime
                          </span>
                        </>
                      )}
                    </div>
                    {item.reportFlag?.reason && (
                      <p className="text-xs text-slate-400">
                        <span className="font-semibold text-slate-300">Flag reason: </span>
                        {item.reportFlag.reason}
                      </p>
                    )}
                    {isAdmin && pendingFlag && (
                      <div className="space-y-3 border-t border-slate-700/60 pt-3">
                        <p className="text-xs font-semibold text-amber-300">
                          Legacy flag — admin review still required
                        </p>
                        <select
                          value={adminAction}
                          onChange={(e) => setAdminAction(e.target.value)}
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                          style={{
                            backgroundColor: "var(--bg-elevated)",
                            borderColor: "var(--border-base)",
                            color: "var(--text-primary)",
                          }}
                        >
                          {ACCOUNT_ACTION_OPTIONS.map((opt) => (
                            <option key={opt.value || "suggest"} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <textarea
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          rows={2}
                          placeholder="Admin notes (optional)"
                          className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            icon={ShieldCheck}
                            label={reviewSubmitting ? "Saving…" : "Confirm & Sanction"}
                            onClick={() => handleReview("confirm")}
                            safe
                          />
                          <Button
                            icon={X}
                            label="Reject Flag"
                            onClick={() => handleReview("reject")}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : canWorkCase ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {item.status === "pending" && (
                        <Button
                          icon={Activity}
                          label="Start Investigating"
                          onClick={() => onStatus("investigating")}
                        />
                      )}
                      <Button
                        icon={ShieldAlert}
                        label="Resolve as Crime"
                        onClick={() => onClassify(true)}
                        danger
                      />
                      <Button
                        icon={ShieldCheck}
                        label="Resolve as Not Crime"
                        onClick={() => onClassify(false)}
                        safe
                      />
                      <Button
                        icon={Archive}
                        label="Archive"
                        onClick={() => onStatus("archived")}
                      />
                    </div>

                    {canFlagReport && (
                      <div className="space-y-3 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-orange-400/90">
                          <Flag size={12} />
                          Mark as False Report
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Use this when the submission is a false report.
                          {hasCitizenReporter
                            ? " Flag count and account sanction apply automatically (1=warning, 2=under review, 3=suspended, 5=blocked)."
                            : " No linked citizen account — case will be marked only."}
                        </p>

                        {hasCitizenReporter && (
                          <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
                            Reporter:{" "}
                            <span className="font-semibold text-white">
                              {reportingUser.name || "Unknown"}
                            </span>
                            {reportingUser.email ? ` · ${reportingUser.email}` : ""}
                            {typeof reportingUser.false_report_count === "number" && (
                              <span className="ml-2 text-orange-300">
                                · Flags: {reportingUser.false_report_count}
                              </span>
                            )}
                          </div>
                        )}

                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-orange-500/40 bg-slate-900/60 px-3 py-3">
                          <input
                            type="checkbox"
                            checked={flagChecked}
                            onChange={(e) => setFlagChecked(e.target.checked)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-orange-500"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-orange-300">
                              False Report
                            </span>
                            <span className="mt-0.5 block text-[11px] text-slate-400">
                              Tick this box to mark the submission as a false report.
                            </span>
                          </span>
                        </label>
                        <div>
                          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                            Reason
                          </label>
                          <textarea
                            value={flagReason}
                            onChange={(e) => setFlagReason(e.target.value)}
                            rows={3}
                            disabled={!flagChecked}
                            placeholder="Explain why this is a false report…"
                            className="w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-orange-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </div>
                        <Button
                          icon={Flag}
                          label={
                            flagSubmitting ? "Flagging…" : "Mark as False Report"
                          }
                          onClick={handleFlagSubmit}
                          danger
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">
                    {isInvestigator
                      ? "Wait for an admin to assign this case to you before updating status."
                      : "Assign an investigator before status updates are available."}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex-1 rounded-xl border border-slate-800 bg-[#111827] p-5">
              <p className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                <FileText size={12} />
                Incident Narrative
              </p>
              <div className="h-40 w-full overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-700/60 bg-[#0d1117] p-4 font-mono text-sm leading-relaxed text-slate-300">
                {history.content
                  ? isCrime || FLAG_STATUSES.has(item.status) || item.status === "crime_case"
                    ? renderCrimeHighlightedText(history.content, true, {
                        matchedKeyword: history.matchedKeyword,
                        blacklistMatches: history.blacklistMatches,
                      })
                    : history.content
                  : "No content available."}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#111827] p-5">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Investigation Notes
              </p>

              <div className="mb-4 max-h-40 space-y-2 overflow-y-auto pr-1">
                {item.notes?.length ? (
                  item.notes.map((note, i) => (
                    <div
                      key={note._id || `${note.createdAt}-${i}`}
                      className="rounded-lg border border-slate-800/50 bg-slate-900/60 p-3"
                    >
                      <p className="text-xs leading-relaxed text-slate-300">
                        {note.text}
                      </p>
                      <p className="mt-1.5 text-[10px] text-slate-600">
                        {note.officer?.name || "Officer"} ·{" "}
                        {formatDate(note.createdAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No notes added yet.</p>
                )}
              </div>

              {canAddNotes && (
                <form onSubmit={onAddNote}>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows="3"
                    placeholder="Add an investigation note..."
                    className="w-full rounded-xl border border-slate-700 bg-[#0d1117] p-3 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-cyan-400"
                  >
                    <MessageSquarePlus size={16} />
                    Add Note
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvestigationReportRow({
  report,
  isAdmin,
  currentUserId,
  onOpen,
  onExport,
  onDelete,
}) {
  const caseItem = report.case || {};
  const ownerId = String(report.investigator?._id || report.investigator || "");
  const isOwn = ownerId === String(currentUserId);
  const caseLabel = caseItem._id
    ? `${caseItem._id.toString().slice(-6).toUpperCase()}`
    : "—";

  return (
    <div
      className="flex flex-col gap-3 overflow-hidden rounded-2xl border sm:flex-row sm:items-center sm:justify-between"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border-base)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="min-w-0 px-4 py-3.5">
        <p
          className="truncate text-sm font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          {report.title}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Case #{caseLabel}
          {" · "}
          {report.investigator?.name || "Investigator"}
          {" · "}
          <span className="uppercase">{report.status}</span>
          {" · "}
          Updated {formatDate(report.updatedAt)}
        </p>
      </div>
      <div
        className="flex flex-wrap gap-2 border-t px-4 py-3 sm:border-t-0 sm:border-l"
        style={{
          borderColor: "var(--border-soft)",
          backgroundColor: "var(--bg-surface)",
        }}
      >
        <CaseActionButton
          icon={Eye}
          label="Open case"
          onClick={onOpen}
          tone="primary"
        />
        {(isAdmin || isOwn) && (
          <CaseActionButton
            icon={Download}
            label="PDF"
            onClick={onExport}
            tone="neutral"
          />
        )}
        {isAdmin && (
          <CaseActionButton
            icon={Trash2}
            label="Delete"
            onClick={onDelete}
            tone="danger"
          />
        )}
      </div>
    </div>
  );
}

function CaseActionButton({ icon: Icon, label, onClick, tone = "neutral" }) {
  const tones = {
    primary: {
      background: "rgba(30, 58, 138, 0.1)",
      color: "#1E3A8A",
      border: "rgba(30, 58, 138, 0.28)",
    },
    success: {
      background: "rgba(16, 185, 129, 0.1)",
      color: "#059669",
      border: "rgba(16, 185, 129, 0.28)",
    },
    danger: {
      background: "rgba(239, 68, 68, 0.1)",
      color: "#dc2626",
      border: "rgba(239, 68, 68, 0.28)",
    },
    neutral: {
      background: "var(--bg-elevated)",
      color: "var(--text-secondary)",
      border: "var(--border-base)",
    },
  };
  const style = tones[tone] || tones.neutral;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition hover:opacity-85"
      style={{
        backgroundColor: style.background,
        color: style.color,
        borderColor: style.border,
      }}
    >
      <Icon size={13} strokeWidth={2.25} />
      {label}
    </button>
  );
}

function Button({ icon: Icon, label, onClick, danger = false, safe = false }) {
  const tone = danger ? "danger" : safe ? "success" : "neutral";
  return (
    <CaseActionButton
      icon={Icon}
      label={label}
      onClick={onClick}
      tone={tone}
    />
  );
}

function formatDate(date) {
  if (!date) return "Not available";
  return new Date(date).toLocaleString();
}

function formatStatus(status = "") {
  return (
    {
      pending: "Pending",
      investigating: "Investigating",
      crime_case: "Verified (Crime Case)",
      not_crime: "Not Crime",
      false_report: "False Report",
      misleading_information: "Misleading Information",
      malicious_report: "Malicious Report",
      resolved: "Resolved",
      archived: "Archived",
    }[status] || status
  );
}
