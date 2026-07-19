import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  History,
  Inbox,
  ListChecks,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";
import API from "../api";
import { getStoredUser } from "../theme";
const READ_NOTIFICATION_STORAGE_KEY = "bareai.readNotificationRecords";

export default function Notifications() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHistoryPage = location.pathname.endsWith("/history");
  const user = getStoredUser();
  const isInvestigator = user?.role === "investigator";
  const [newRecords, setNewRecords] = useState([]);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const markingReadKeys = useRef(new Set());
  const hasLoadedOnce = useRef(false);
  const selectedRef = useRef(null);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const visibleRecords = isHistoryPage
    ? historyRecords
    : (() => {
        // New panel keeps unread items visible. The currently opened item
        // stays in the list even after it is marked read.
        const unread = newRecords.filter((record) => !record.read);
        if (
          selected &&
          !unread.some((record) => record._id === selected._id)
        ) {
          return sortByDate([selected, ...unread]);
        }
        return unread;
      })();

  const applyLoadedNotifications = ({ newItems, historyItems }) => {
    const openSelected = selectedRef.current;

    setHistoryRecords(historyItems);
    setNewRecords(() => {
      // Silent refresh must not yank away the notification the user just opened.
      const selectedId = openSelected?._id;
      if (!selectedId || isHistoryPage) return newItems;

      const stillUnread = newItems.find((item) => item._id === selectedId);
      if (stillUnread) return newItems;

      const fromHistory = historyItems.find((item) => item._id === selectedId);
      const openItem = fromHistory || openSelected;
      if (!openItem) return newItems;

      return sortByDate([
        { ...openItem, read: true },
        ...newItems.filter((item) => item._id !== selectedId),
      ]);
    });
    setSelected((current) => {
      if (!current) return null;
      const all = [...newItems, ...historyItems];
      return all.find((record) => record._id === current._id) || current;
    });
  };

  const loadNotifications = async ({ silent = false } = {}) => {
    try {
      if (!silent || !hasLoadedOnce.current) {
        setLoading(true);
      }
      setError("");

      const { newItems, historyItems } = await loadSystemNotifications();
      applyLoadedNotifications({ newItems, historyItems });
      hasLoadedOnce.current = true;
    } catch (err) {
      console.error("Notification loading error:", err);
      setError(err.response?.data?.message || "Failed to load notifications");
      if (!silent) {
        setNewRecords([]);
        setHistoryRecords([]);
        setSelected(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadNotifications({ silent: false });
  };

  const investigateAlert = async (alert) => {
    const historyId = alert.history?._id || alert.history || alert.case?.history?._id;
    const existingCaseId = alert.case?._id;

    if (existingCaseId) {
      navigate(`/cases?case=${existingCaseId}`);
      return;
    }

    if (!historyId) {
      navigate("/cases");
      return;
    }

    try {
      setError("");
      if (alert.notificationId && !alert.read) {
        await markRecordRead(alert, { stayInList: false });
      }
      const res = await API.post("/investigation/cases", { historyId });
      await loadNotifications({ silent: true });
      navigate(`/cases?case=${res.data.case?._id || ""}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send alert to investigation");
    }
  };

  const acceptAvailableCase = async (record) => {
    const caseId = record.case?._id;
    if (!caseId) return;

    try {
      setError("");
      const res = await API.post(`/investigation/cases/${caseId}/accept`);
      const updatedCase = res.data?.case;

      if (record.notificationId && !record.read) {
        await markRecordRead(record, { stayInList: false });
      }

      await loadNotifications({ silent: true });
      navigate(`/cases?case=${updatedCase?._id || caseId}`);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "This case was already accepted by another investigator"
      );
      await loadNotifications({ silent: true });
    }
  };

  // Selecting a notification opens it and marks only that item as read.
  // Opening the notifications page alone never marks anything as read.
  const selectRecord = (record) => {
    setSelected(record);

    if (!isHistoryPage && !record.read) {
      markRecordRead(record, { stayInList: true });
    }
  };

  const markRecordRead = async (record, { stayInList = true } = {}) => {
    const recordKey = getNotificationRecordKey(record);
    if (recordKey && markingReadKeys.current.has(recordKey)) return;

    if (isHistoryPage || record.read) {
      setSelected(record);
      return;
    }

    if (recordKey) markingReadKeys.current.add(recordKey);

    let marked = false;

    if (!record.notificationId) {
      hideLocalNotificationRecord(record);
      marked = true;
    } else {
      try {
        await API.patch(`/notifications/${record.notificationId}/read`);
        marked = true;
      } catch {
        // Keep local unread state if the server update fails.
      }
    }

    if (recordKey) markingReadKeys.current.delete(recordKey);

    if (!marked) return;

    // Unread badge updates only after this specific notification is read.
    window.dispatchEvent(new Event("notifications:read"));

    if (stayInList && !isHistoryPage) {
      // Keep it visible in the open panel; only clear the unread state.
      const updated = { ...record, read: true };
      setNewRecords((current) =>
        current.map((item) => (item._id === record._id ? updated : item))
      );
      setHistoryRecords((current) =>
        sortByDate([
          updated,
          ...current.filter((item) => item._id !== record._id),
        ])
      );
      setSelected((current) =>
        current?._id === record._id ? updated : current
      );
      return;
    }

    moveRecordToHistory({ ...record, read: true });
  };

  const moveRecordToHistory = (record) => {
    setNewRecords((current) => current.filter((item) => item._id !== record._id));
    setHistoryRecords((current) =>
      sortByDate([
        { ...record, read: true },
        ...current.filter((item) => item._id !== record._id),
      ])
    );
    setSelected((current) =>
      current?._id === record._id ? { ...record, read: true } : current
    );
  };

  useEffect(() => {
    hasLoadedOnce.current = false;
    loadNotifications({ silent: false });

    // Background refresh must not blank the panel (that made unread items "disappear").
    const interval = setInterval(() => {
      loadNotifications({ silent: true });
    }, 10000);

    return () => clearInterval(interval);
  }, [isInvestigator, isHistoryPage]);

  useEffect(() => {
    if (!isHistoryPage) return;

    const selectedId = location.state?.selectedId;
    if (!selectedId || historyRecords.length === 0) return;

    const match = historyRecords.find((record) => record._id === selectedId);
    if (match) setSelected(match);
  }, [isHistoryPage, location.state, historyRecords]);

  const classifyAssignedCase = async (record, isCrime) => {
    const caseId = record.case?._id;
    if (!caseId) return;

    try {
      setError("");
      const res = await API.patch(`/investigation/cases/${caseId}`, { isCrime });
      const updatedCase = res.data?.case;
      if (!updatedCase) return;

      const mergeCase = (item) =>
        item._id === record._id ? { ...item, case: updatedCase } : item;

      setNewRecords((current) => current.map(mergeCase));
      setHistoryRecords((current) => current.map(mergeCase));
      setSelected((current) =>
        current?._id === record._id ? { ...current, case: updatedCase } : current
      );
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to update case verdict"
      );
    }
  };

  const openAssignedCase = async (record) => {
    const caseId = record.case?._id;
    if (!caseId) {
      navigate("/cases");
      return;
    }

    if (!record.read) {
      await markRecordRead(record, { stayInList: false });
    }

    navigate(`/cases?case=${caseId}`);
  };

  return (
    <div
      className="min-h-screen w-full p-8 transition-colors duration-300"
      style={{ background: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            {/* <p className="text-sm text-cyan-400 font-semibold">
              {isHistoryPage
                ? "BAREAI Notification History"
                : isInvestigator
                ? "BAREAI Assignment Center"
                : "BAREAI Live Alerts"}
            </p> */}

            <h1 className="text-3xl font-bold mt-1">
              {isHistoryPage
                ? "Notification History"
                : isInvestigator
                ? "Investigation Case Queue"
                : "Crime Detection Alerts"}
            </h1>

            {/* <p className="text-sm text-slate-400 mt-2">
              {isHistoryPage
                ? "Notifications you have previously read."
                : isInvestigator
                ? "Assigned and available cases. Open Case Management to add notes and resolve."
                : "Facebook crime alerts from blacklist scans. Investigate → Case → assign officer."}
            </p> */}
          </div>

          <div className="flex flex-wrap gap-2">
            {isHistoryPage ? (
              <button
                type="button"
                onClick={() => navigate("/notifications")}
                className="inline-flex items-center gap-2 bg-slate-800 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-700"
              >
                <Bell size={16} />
                New Notifications
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/notifications/history")}
                className="inline-flex items-center gap-2 bg-slate-800 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl font-bold text-sm hover:bg-slate-700"
              >
                <History size={16} />
                View History
              </button>
            )}
            <button
              onClick={handleRefresh}
              className="bg-cyan-500 text-slate-950 px-4 py-2 rounded-xl font-bold text-sm hover:bg-cyan-400"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-5 bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-xl">
            {error}
          </div>
        )}

        {loading && !hasLoadedOnce.current ? (
          <p className="text-slate-400">Loading notifications...</p>
        ) : visibleRecords.length === 0 ? (
          <EmptyState isInvestigator={isInvestigator} isHistory={isHistoryPage} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-3">
              {visibleRecords.map((record) => (
                <button
                  key={record._id}
                  onClick={() => selectRecord(record)}
                  className={`w-full text-left rounded-2xl border p-4 transition ${
                    selected?._id === record._id
                      ? "bg-cyan-500/10 border-cyan-500"
                      : isHistoryPage
                      ? "bg-slate-900/70 border-slate-800 hover:border-slate-600 opacity-90"
                      : "bg-slate-900 border-slate-800 hover:border-slate-600"
                  }`}
                >
                  {isInvestigator ? (
                    <AssignedCaseListItem record={record} isHistory={isHistoryPage} />
                  ) : (
                    <AdminNotificationListItem record={record} isHistory={isHistoryPage} />
                  )}
                </button>
              ))}
            </div>

            <div className="lg:col-span-2">
              {selected ? (
                isInvestigator ? (
                  <AssignedCaseDetails
                    record={selected}
                    onOpenCase={() => openAssignedCase(selected)}
                    onMarkRead={() => markRecordRead(selected)}
                    onClassify={(isCrime) => classifyAssignedCase(selected, isCrime)}
                    onAccept={() => acceptAvailableCase(selected)}
                    isHistory={isHistoryPage}
                  />
                ) : (
                  <AdminNotificationDetails
                    record={selected}
                    onInvestigate={investigateAlert}
                    onGoToCases={() =>
                      navigate(
                        selected.case?._id
                          ? `/cases?case=${selected.case._id}`
                          : "/cases"
                      )
                    }
                    onMarkRead={() => markRecordRead(selected)}
                    isHistory={isHistoryPage}
                  />
                )
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
                  <Eye className="mx-auto text-slate-500 mb-3" size={36} />

                  <p className="text-slate-400">
                    {isHistoryPage
                      ? "Select a notification from history to view details."
                      : "Select a notification to view details."}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

async function loadSystemNotifications() {
  const notificationsRes = await API.get("/notifications");
  const notifications = Array.isArray(notificationsRes.data)
    ? notificationsRes.data
    : [];

  const mapped = notifications
    .filter((notification) => notification.active !== false)
    .filter((notification) => notification.type !== "case_taken")
    .map((notification) => {
      const investigationCase = notification.case || null;
      const history = investigationCase?.history || {};

      return {
        _id: notification._id,
        notificationId: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        read: notification.read,
        case: investigationCase,
        history,
        content: history.content || "",
        createdAt: notification.createdAt,
        source: "notification",
      };
    });

  return {
    newItems: sortByDate(mapped.filter((record) => !record.read)),
    historyItems: sortByDate(mapped.filter((record) => record.read)),
  };
}

function sortByDate(list = []) {
  return [...list].sort(
    (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );
}

function getStoredReadNotificationKeys() {
  try {
    return JSON.parse(localStorage.getItem(READ_NOTIFICATION_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function hideLocalNotificationRecord(record) {
  const key = getNotificationRecordKey(record);
  if (!key) return;

  const keys = new Set(getStoredReadNotificationKeys());
  keys.add(key);
  localStorage.setItem(READ_NOTIFICATION_STORAGE_KEY, JSON.stringify([...keys]));
}

function getNotificationRecordKey(record = {}) {
  const history = record.history || record.case?.history || {};
  const content = record.content || history.content || "";

  return [
    record.notificationId || "",
    record._id || "",
    record.postId || "",
    history._id || "",
    record.blacklistItem?._id || record.blacklistItem || "",
    record.matchedValue || "",
    record.contentFingerprint || normalizeAlertContent(content),
  ]
    .filter(Boolean)
    .join("|");
}

function AssignedCaseListItem({ record, isHistory }) {
  const item = record.case || {};
  const history = item.history || {};
  const isAvailable = record.type === "case_available" && !item.assignedOfficer;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ListChecks className="text-cyan-300 shrink-0" size={18} />

          <h3 className="font-bold text-sm truncate">
            {record.title ||
              (isAvailable
                ? "Crime case available"
                : "Assigned investigation case")}
          </h3>
        </div>

        {!isHistory && !record.read && (
          <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-300 border border-red-500/30">
            {isAvailable ? "Accept" : "New"}
          </span>
        )}
        {(isHistory || record.read) && (
          <span className="text-xs px-2 py-1 rounded-full bg-slate-500/10 text-slate-400 border border-slate-600">
            Read
          </span>
        )}
      </div>

      <p className="text-sm text-slate-400 mt-3 line-clamp-2">
        {history.content || record.message || "No case content available"}
      </p>

      <div className="flex items-center gap-2 text-xs text-slate-500 mt-3">
        <Clock size={13} />
        {formatDate(record.createdAt || item.createdAt)}
      </div>
    </>
  );
}

function AdminNotificationListItem({ record, isHistory }) {
  const history = record.history || record.case?.history || {};

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="text-red-400 shrink-0" size={18} />

          <h3 className="font-bold text-sm truncate">
            {record.title || "Crime detected by AI"}
          </h3>
        </div>

        {!isHistory && !record.read && (
          <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-300 border border-red-500/30">
            New
          </span>
        )}
        {(isHistory || record.read) && (
          <span className="text-xs px-2 py-1 rounded-full bg-slate-500/10 text-slate-400 border border-slate-600">
            Read
          </span>
        )}
      </div>

      <p className="text-sm text-slate-400 mt-3 line-clamp-2">
        {history.content || record.content || record.message || "No content available"}
      </p>

      <div className="flex items-center gap-2 text-xs text-slate-500 mt-3">
        <Clock size={13} />
        {formatDate(record.createdAt)}
      </div>
    </>
  );
}

function AssignedCaseDetails({
  record,
  onOpenCase,
  onMarkRead,
  onClassify,
  onAccept,
  isHistory,
}) {
  const item = record.case || {};
  const history = item.history || {};
  const isAvailable =
    record.type === "case_available" &&
    !item.assignedOfficer &&
    item.status === "pending";
  const canClassify =
    !isAvailable &&
    item.status !== "crime_case" &&
    item.status !== "not_crime" &&
    item.status !== "archived";
  const verdictLabel =
    item.status === "crime_case"
      ? "Crime"
      : item.status === "not_crime"
      ? "Not Crime"
      : "Pending";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-cyan-400 font-semibold">
            {isAvailable
              ? "Shared Investigation Queue"
              : "Assigned Investigation Case"}
          </p>

          <h2 className="text-2xl font-bold mt-1">
            {(history.sourceType || history.type || "Record").toUpperCase()} Case
          </h2>

          <p className="text-sm text-slate-400 mt-2">
            {record.message ||
              (isAvailable
                ? "Accept this case to become the assigned investigator. The first acceptance wins."
                : "This case has been assigned to you for review.")}
          </p>
        </div>

        <span className={statusClass(item.status)}>{formatStatus(item.status)}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <Info
          icon={User}
          label="Assigned Officer"
          value={
            item.assignedOfficer?.name ||
            (isAvailable ? "Unassigned — accept to claim" : "You")
          }
        />
        <Info label="Source Type" value={history.sourceType || history.type || "record"} />
        <Info label="Status" value={formatStatus(item.status)} />
        <Info label="Prediction" value={history.prediction || "Not provided"} />
        <Info label="Investigator Verdict" value={verdictLabel} />
        <Info
          label="Confidence"
          value={
            history.confidence || history.confidence === 0
              ? `${history.confidence}%`
              : "Not provided"
          }
        />
        <Info label="Notified" value={formatDate(record.createdAt)} />
        <Info label="Case Time" value={formatDate(item.createdAt)} />
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 text-cyan-300 font-bold mb-3">
          <Inbox size={18} />
          Case Content
        </div>

        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-7">
          {history.content || "No content available"}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {isAvailable && !isHistory && (
          <button
            type="button"
            onClick={onAccept}
            className="inline-flex items-center gap-2 bg-cyan-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-sm hover:bg-cyan-400"
          >
            <CheckCircle2 size={16} />
            Accept Case
          </button>
        )}

        {canClassify && (
          <>
            <button
              type="button"
              onClick={() => onClassify(true)}
              className="inline-flex items-center gap-2 bg-red-500/10 text-red-300 border border-red-500/30 font-bold px-4 py-2 rounded-xl text-sm hover:bg-red-500/20"
            >
              <ShieldAlert size={16} />
              Crime Case
            </button>
            <button
              type="button"
              onClick={() => onClassify(false)}
              className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold px-4 py-2 rounded-xl text-sm hover:bg-emerald-500/20"
            >
              <ShieldCheck size={16} />
              Not Crime
            </button>
          </>
        )}

        {!canClassify &&
          !isAvailable &&
          (item.status === "crime_case" || item.status === "not_crime") && (
          <span
            className={`inline-flex items-center gap-2 font-bold px-4 py-2 rounded-xl text-sm border ${
              item.status === "crime_case"
                ? "bg-red-500/10 text-red-300 border-red-500/30"
                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
            }`}
          >
            {item.status === "crime_case" ? (
              <ShieldAlert size={16} />
            ) : (
              <ShieldCheck size={16} />
            )}
            {item.status === "crime_case" ? "Crime — Confirmed" : "Not Crime"}
          </span>
        )}

        {!isAvailable && (
          <button
            type="button"
            onClick={onOpenCase}
            className="inline-flex items-center gap-2 bg-cyan-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-sm hover:bg-cyan-400"
          >
            <ListChecks size={16} />
            Open in Case Management
          </button>
        )}

        {isHistory || record.read ? (
          <span className="inline-flex items-center gap-2 text-slate-400 bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl text-sm">
            <History size={16} />
            Read Notification
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={onMarkRead}
              className="inline-flex items-center gap-2 text-red-300 bg-red-500/10 border border-red-500/30 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-500/20"
            >
              <CheckCircle2 size={16} />
              Mark as Read
            </button>
            <span className="inline-flex items-center gap-2 text-red-300 bg-red-500/10 border border-red-500/30 px-4 py-2 rounded-xl text-sm">
              <Bell size={16} />
              {isAvailable ? "Unread Queue Item" : "Unread Assignment"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function AdminNotificationDetails({
  record,
  onInvestigate,
  onGoToCases,
  onMarkRead,
  isHistory,
}) {
  const item = record.case || {};
  const history = record.history || item.history || {};
  const assignedName = item.assignedOfficer?.name;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-sm text-red-400 font-semibold">
            {record.type === "case_updated"
              ? "Case Update"
              : "Crime Alert Detected"}
          </p>

          <h2 className="text-2xl font-bold mt-1">
            {record.title || "Crime detected by AI"}
          </h2>

          <p className="text-sm text-slate-400 mt-2">
            {record.message ||
              "AI flagged crime-related content. All investigators have been notified."}
          </p>
        </div>

        {item.status && (
          <span className={statusClass(item.status)}>{formatStatus(item.status)}</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <Info
          icon={User}
          label="Assigned Investigator"
          value={assignedName || "Waiting for first investigator to accept"}
        />
        <Info label="Source Type" value={history.sourceType || history.type || "analysis"} />
        <Info label="Case Status" value={formatStatus(item.status) || "Pending"} />
        <Info label="Prediction" value={history.prediction || "CRIME-RELATED"} />
        <Info
          label="Confidence"
          value={
            history.confidence || history.confidence === 0
              ? `${history.confidence}%`
              : "Not provided"
          }
        />
        <Info label="Detected Time" value={formatDate(record.createdAt)} />
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 text-red-300 font-bold mb-3">
          <AlertTriangle size={18} />
          Detected Crime Content
        </div>

        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-7">
          {history.content || record.content || "No content available"}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {!isHistory && item._id && (
          <button
            type="button"
            onClick={() => onInvestigate(record)}
            className="inline-flex items-center gap-2 bg-cyan-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-sm hover:bg-cyan-400"
          >
            <ShieldAlert size={16} />
            Open Case
          </button>
        )}

        {!isHistory && !record.read && (
          <button
            type="button"
            onClick={() => onMarkRead(record)}
            className="inline-flex items-center gap-2 bg-slate-800 text-slate-200 border border-slate-700 font-bold px-4 py-2 rounded-xl text-sm hover:bg-slate-700"
          >
            <CheckCircle2 size={16} />
            Mark as Read
          </button>
        )}

        <button
          type="button"
          onClick={onGoToCases}
          className="inline-flex items-center gap-2 bg-slate-800 text-slate-200 border border-slate-700 font-bold px-4 py-2 rounded-xl text-sm hover:bg-slate-700"
        >
          <Eye size={16} />
          Go to Case Management
        </button>

        <span className="inline-flex items-center gap-2 text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-xl text-sm">
          <CheckCircle2 size={16} />
          {assignedName
            ? `Assigned to ${assignedName}`
            : "Broadcast to all investigators"}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ isInvestigator, isHistory }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
      {isHistory ? (
        <History className="mx-auto text-slate-500 mb-4" size={42} />
      ) : (
        <Bell className="mx-auto text-slate-500 mb-4" size={42} />
      )}

      <h2 className="text-xl font-bold">
        {isHistory
          ? "No history yet"
          : isInvestigator
          ? "No cases in your queue"
          : "No new crime alerts yet"}
      </h2>

      <p className="text-slate-400 mt-2">
        {isHistory
          ? "Notifications you read will appear here."
          : isInvestigator
          ? "When AI detects a crime, the case appears here for every investigator. Accept it to claim the assignment."
          : "When AI detects crime-related content, a notification appears here first, then the case is sent to all investigators."}
      </p>
    </div>
  );
}

function Info({ label, value, icon: Icon }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 font-bold">
        {Icon && <Icon size={14} />}
        {label}
      </div>

      <div className="text-sm text-slate-200 mt-2 break-all">
        {value || "Not available"}
      </div>
    </div>
  );
}

function statusClass(status) {
  const classes = {
    pending: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    investigating: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    crime_case: "bg-red-500/10 text-red-300 border-red-500/30",
    not_crime: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    resolved: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    archived: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  };

  return `text-xs px-2 py-1 rounded-full border ${
    classes[status] || "bg-slate-500/10 text-slate-300 border-slate-500/30"
  }`;
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
    }[status] || status || "Pending"
  );
}

function formatDate(date) {
  if (!date) return "Not available";

  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeAlertContent(value = "") {
  return String(value)
    .toLowerCase()
    .replace(
      /\b\d+\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\b/g,
      ""
    )
    .replace(/[·•]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
