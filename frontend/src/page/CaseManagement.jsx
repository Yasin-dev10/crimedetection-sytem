import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Archive,
  ClipboardList,
  Eye,
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

const ACTIVE_STATUSES = new Set(["pending", "investigating"]);

const getSortedOfficers = (officers) =>
  [...officers].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );

const statusStyles = {
  pending: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  investigating: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  crime_case: "bg-red-500/10 text-red-300 border-red-500/30",
  not_crime: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  resolved: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  archived: "bg-slate-500/10 text-slate-300 border-slate-500/30",
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
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const claimingRef = useRef(new Set());

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
        ? [API.get("/investigation/cases?status=all"), API.get("/investigation/officers")]
        : [API.get("/investigation/cases?status=all")];

      const [casesRes, officersRes] = await Promise.all(
        isAdmin ? requests : [requests[0], Promise.resolve({ data: [] })]
      );

      setCases(Array.isArray(casesRes.data) ? casesRes.data : []);
      setOfficers(Array.isArray(officersRes.data) ? officersRes.data : []);
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
    }),
    [cases]
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
      archived: "Archived Cases",
    }[viewFilter] || "Cases";

  return (
    <div
      className="w-full transition-colors duration-300"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h1 className="mt-1 text-3xl font-bold">Case Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              {isInvestigator
                ? "When AI detects a crime, available cases appear here for every investigator. Open a case first to claim it — others are removed automatically."
                : "Assigned cases, active investigations, notes, status updates, and case resolution in one workspace. AI crime cases are broadcast to all investigators."}
            </p>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            {success && <p className="mt-2 text-sm text-emerald-400">{success}</p>}
          </div>

          <select
            value={viewFilter}
            onChange={(e) => setViewFilter(e.target.value)}
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm"
          >
            <option value="active">Active Cases</option>
            <option value="assigned">Assigned (Open)</option>
            <option value="resolved">Case Resolution</option>
            <option value="all">All Cases</option>
            <option value="pending">Pending</option>
            <option value="investigating">Investigating</option>
            <option value="crime_case">Crime Case</option>
            <option value="not_crime">Not Crime</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Metric title="Assigned (Open)" value={totals.assigned} icon={UserCheck} />
          <Metric title="Active Cases" value={totals.active} icon={Activity} />
          <Metric title="Investigating" value={totals.investigating} icon={Eye} />
          <Metric title="Resolved" value={totals.resolved} icon={ShieldCheck} />
        </div>

        {loading ? (
          <p className="text-slate-400">Loading case management...</p>
        ) : (
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <ClipboardList className="text-cyan-300" size={20} />
              {sectionTitle}
            </h2>

            {visibleCases.length === 0 ? (
              <p className="text-sm text-slate-400">
                {isInvestigator
                  ? "No cases in this view. Available crime cases and your open assigned work appear here."
                  : "No cases found in this view."}
              </p>
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
            onAddNote={addNote}
          />
        )}
      </div>
    </div>
  );
}

function Metric({ title, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <h2 className="mt-2 text-3xl font-bold">{value}</h2>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
          <Icon size={22} />
        </div>
      </div>
    </div>
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
    isInvestigator &&
    item.assignedOfficer &&
    item.status !== "crime_case" &&
    item.status !== "not_crime" &&
    item.status !== "archived";

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                statusStyles[item.status]
              }`}
            >
              {formatStatus(item.status)}
            </span>
            <span className="text-xs text-slate-500">
              {formatDate(history.createdAt || item.createdAt)}
            </span>
          </div>

          <h3 className="mt-3 font-bold">
            {(history.sourceType || history.type || "record").toUpperCase()}{" "}
            Investigation Case
          </h3>

          <p className="mt-2 line-clamp-2 text-sm text-slate-400">
            {history.content}
          </p>

          <div className="mt-2 text-xs text-slate-500">
            Officer:{" "}
            {item.assignedOfficer?.name ||
              (item.status === "pending"
                ? "Available — open to claim"
                : "Not assigned")}
            {" · "}
            Notes: {item.notes?.length || 0}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {isAdmin && (
            <button
              type="button"
              onClick={onAssign}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-bold text-cyan-300 transition hover:bg-cyan-500/20"
            >
              <UserPlus size={12} />
              Assign
            </button>
          )}
          {canWorkCase && item.status === "pending" && (
            <Button
              icon={Activity}
              label="Start Investigating"
              onClick={() => onStatus("investigating")}
            />
          )}
          {canWorkCase && (
            <>
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
            </>
          )}
          <Button icon={Eye} label="View" onClick={onView} />
          {isAdmin && (
            <Button icon={Trash2} label="Delete" danger onClick={onDelete} />
          )}
        </div>
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
  onAddNote,
}) {
  const history = item.history || {};
  const confidence = history.confidence || 0;
  const isCrime = history.isCrime;
  const savedOfficerId = item.assignedOfficer?._id || "";
  const [pendingOfficerId, setPendingOfficerId] = useState(savedOfficerId);

  const canWorkCase =
    (isInvestigator || isAdmin) &&
    item.assignedOfficer &&
    item.status !== "crime_case" &&
    item.status !== "not_crime" &&
    item.status !== "archived";
  const canAddNotes =
    isAdmin ||
    (isInvestigator &&
      item.assignedOfficer &&
      item.status !== "archived");

  useEffect(() => {
    setPendingOfficerId(item.assignedOfficer?._id || "");
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
        label: "Confirmed Crime Case",
        badge: "Crime",
        badgeColor: "bg-red-500 text-white",
      },
      not_crime: {
        label: "Dismissed — Not Crime",
        badge: "Closed",
        badgeColor: "bg-slate-500 text-white",
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
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#111827] p-5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Assignment
              </p>
              {isAdmin ? (
                <OfficerAssignmentPanel
                  officers={officers}
                  selectedOfficerId={pendingOfficerId}
                  savedOfficerId={savedOfficerId}
                  onSelectOfficer={setPendingOfficerId}
                  onSave={handleSave}
                />
              ) : (
                <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <User size={14} className="text-slate-400" />
                  {item.assignedOfficer
                    ? `Det. ${item.assignedOfficer.name}`
                    : "Not Assigned"}
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
            </div>

            {(isInvestigator || isAdmin) && (
              <div
                className="rounded-xl border border-slate-800 p-5"
                style={{ backgroundColor: "var(--bg-card)" }}
              >
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Status Updates & Resolution
                </p>

                {item.status === "crime_case" || item.status === "not_crime" ? (
                  <div className="flex items-center gap-2">
                    {item.status === "crime_case" ? (
                      <>
                        <ShieldAlert size={18} className="shrink-0 text-red-400" />
                        <span className="text-sm font-bold text-red-300">
                          Crime — Confirmed
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
                ) : canWorkCase ? (
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
              <textarea
                readOnly
                value={history.content || "No content available."}
                className="h-56 w-full resize-none rounded-xl border border-slate-700/60 bg-[#0d1117] p-4 font-mono text-sm leading-relaxed text-slate-300 outline-none"
              />
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

function Button({ icon: Icon, label, onClick, danger = false, safe = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${
        danger
          ? "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
          : safe
          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
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
      crime_case: "Crime Case",
      not_crime: "Not Crime",
      resolved: "Resolved",
      archived: "Archived",
    }[status] || status
  );
}
