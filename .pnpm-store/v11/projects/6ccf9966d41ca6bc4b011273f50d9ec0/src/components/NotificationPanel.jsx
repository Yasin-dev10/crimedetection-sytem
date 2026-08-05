import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCircle2,
  Clock,
  Globe,
  ListChecks,
  MessageCircle,
  ShieldAlert,
  X,
} from "lucide-react";
import API from "../api";
import { renderCrimeHighlightedText } from "../utils/crimeHighlight";

const SOURCE_TABS = [
  { id: "facebook", label: "Facebook", icon: MessageCircle },
  { id: "website", label: "Website", icon: Globe },
];

export default function NotificationPanel({ open, onClose, onUnreadChange }) {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeSource, setActiveSource] = useState("facebook");

  const facebookItems = useMemo(
    () => items.filter((item) => item.source === "facebook"),
    [items]
  );
  const websiteItems = useMemo(
    () => items.filter((item) => item.source !== "facebook"),
    [items]
  );
  const visibleItems = activeSource === "facebook" ? facebookItems : websiteItems;

  const loadUnread = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get("/notifications");
      const notifications = Array.isArray(res.data) ? res.data : [];

      const unread = notifications
        .filter((n) => n.active !== false && n.type !== "case_taken" && !n.read)
        .map(mapNotification)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      setItems(unread);
      onUnreadChange?.(unread.length);
      setSelected(null);

      const facebookCount = unread.filter((item) => item.source === "facebook").length;
      const websiteCount = unread.length - facebookCount;
      if (facebookCount === 0 && websiteCount > 0) {
        setActiveSource("website");
      } else if (websiteCount === 0 && facebookCount > 0) {
        setActiveSource("facebook");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load notifications");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setSelected(null);
      return;
    }
    loadUnread();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose?.();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onClose]);

  const openNotification = async (record) => {
    setSelected({ ...record });
    if (record.read) return;

    try {
      if (record.notificationId) {
        await API.patch(`/notifications/${record.notificationId}/read`);
      }

      setItems((current) => {
        const next = current.filter((item) => item._id !== record._id);
        onUnreadChange?.(next.length);
        return next;
      });
      setSelected({ ...record, read: true });
      window.dispatchEvent(new Event("notifications:read"));
    } catch {
      setError("Could not mark notification as read");
    }
  };

  const openCase = async (record) => {
    const caseId = record.case?._id;
    if (!record.read && record.notificationId) {
      try {
        await API.patch(`/notifications/${record.notificationId}/read`);
        setItems((current) => {
          const next = current.filter((item) => item._id !== record._id);
          onUnreadChange?.(next.length);
          return next;
        });
        window.dispatchEvent(new Event("notifications:read"));
      } catch {
        // Still open the case.
      }
    }

    if (record.type === "case_available" && caseId) {
      try {
        await API.post(`/investigation/cases/${caseId}/accept`);
        setItems((current) => {
          const next = current.filter(
            (item) =>
              item._id !== record._id &&
              item.case?._id !== caseId
          );
          onUnreadChange?.(next.length);
          return next;
        });
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "This case was already claimed by another investigator"
        );
        setItems((current) => {
          const next = current.filter((item) => item.case?._id !== caseId);
          onUnreadChange?.(next.length);
          return next;
        });
        return;
      }
    }

    onClose?.();
    navigate(caseId ? `/cases?case=${caseId}` : "/cases");
  };

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-11 z-50 w-[min(440px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border shadow-2xl"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border-base)",
        color: "var(--text-primary)",
      }}
    >
      <div
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: "var(--border-base)" }}
      >
        <div className="flex items-center gap-2">
          <Bell size={16} style={{ color: "var(--brand)" }} />
          <h3 className="text-sm font-bold">Notifications</h3>
          {items.length > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {items.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 transition hover:opacity-80"
          style={{ color: "var(--text-muted)" }}
          aria-label="Close notifications"
        >
          <X size={16} />
        </button>
      </div>

      <div
        className="grid grid-cols-2 gap-1 border-b p-2"
        style={{ borderColor: "var(--border-base)" }}
        role="tablist"
        aria-label="Notification source"
      >
        {SOURCE_TABS.map((tab) => {
          const Icon = tab.icon;
          const count = tab.id === "facebook" ? facebookItems.length : websiteItems.length;
          const isActive = activeSource === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveSource(tab.id);
                setSelected(null);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition"
              style={{
                backgroundColor: isActive ? "var(--brand)" : "var(--bg-elevated)",
                color: isActive ? "#fff" : "var(--text-secondary)",
                border: `1px solid ${isActive ? "var(--brand)" : "var(--border-base)"}`,
              }}
            >
              <Icon size={13} />
              {tab.label}
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                style={{
                  backgroundColor: isActive ? "rgba(255,255,255,0.2)" : "var(--brand-soft)",
                  color: isActive ? "#fff" : "var(--brand)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="max-h-[70vh] overflow-y-auto">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Loading...
          </p>
        ) : visibleItems.length === 0 && !selected ? (
          <div className="px-4 py-10 text-center">
            {activeSource === "facebook" ? (
              <MessageCircle className="mx-auto mb-3 opacity-40" size={28} />
            ) : (
              <Globe className="mx-auto mb-3 opacity-40" size={28} />
            )}
            <p className="text-sm font-semibold">
              No unread {activeSource === "facebook" ? "Facebook" : "Website"} notifications
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {activeSource === "facebook"
                ? "Facebook crime detections and case assignments will appear here."
                : "Website crime detections and case assignments will appear here."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1">
            {visibleItems.length > 0 && (
              <div
                className="max-h-[40vh] space-y-1 overflow-y-auto border-b p-2"
                style={{ borderColor: "var(--border-base)" }}
              >
                {visibleItems.map((record) => (
                  <button
                    key={record._id}
                    type="button"
                    onClick={() => openNotification(record)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      selected?._id === record._id
                        ? "border-[var(--brand-ring)] bg-[var(--brand-soft)]"
                        : "hover:opacity-95"
                    }`}
                    style={{
                      borderColor:
                        selected?._id === record._id
                          ? undefined
                          : "var(--border-base)",
                      backgroundColor:
                        selected?._id === record._id
                          ? undefined
                          : "var(--bg-elevated)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{
                              backgroundColor: "var(--brand-soft)",
                              color: "var(--brand)",
                            }}
                          >
                            {record.source === "facebook" ? (
                              <MessageCircle size={10} />
                            ) : (
                              <Globe size={10} />
                            )}
                            {sourceLabel(record.source)}
                          </span>
                          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
                            New
                          </span>
                        </div>
                        <p className="truncate text-sm font-bold">
                          {record.title || "Notification"}
                        </p>
                        <p
                          className="mt-1 line-clamp-2 text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {record.case?.history?.content ||
                            record.message ||
                            "No details"}
                        </p>
                      </div>
                    </div>
                    <div
                      className="mt-2 flex items-center gap-1 text-[10px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <Clock size={11} />
                      {formatDate(record.createdAt)}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {selected && (
              <div className="space-y-3 p-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--brand)" }}
                    >
                      {selected.type === "crime_detected"
                        ? "Crime detected"
                        : selected.type === "case_available"
                        ? "Case available"
                        : selected.type === "case_assigned"
                        ? "Case assigned"
                        : "Notification"}
                    </p>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{
                        backgroundColor: "var(--brand-soft)",
                        color: "var(--brand)",
                      }}
                    >
                      {selected.source === "facebook" ? (
                        <MessageCircle size={10} />
                      ) : (
                        <Globe size={10} />
                      )}
                      {sourceLabel(selected.source)}
                    </span>
                  </div>
                  <h4 className="mt-1 text-base font-bold">
                    {selected.title || "Notification"}
                  </h4>
                  <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    {selected.message}
                  </p>
                </div>

                {selected.case?.history?.content && (
                  <div
                    className="rounded-xl border p-3 text-sm"
                    style={{
                      borderColor: "var(--border-base)",
                      backgroundColor: "var(--bg-elevated)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Content
                    </p>
                    <p className="line-clamp-6 whitespace-pre-wrap">
                      {renderCrimeHighlightedText(
                        selected.case.history.content,
                        selected.case.history.isCrime !== false,
                        {
                          matchedKeyword: selected.case.history.matchedKeyword,
                          blacklistMatches:
                            selected.case.history.blacklistMatches,
                        }
                      )}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openCase(selected)}
                    className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold"
                    style={{
                      borderColor: "var(--border-base)",
                      backgroundColor:
                        selected.type === "case_available"
                          ? "var(--brand-soft)"
                          : "var(--bg-elevated)",
                      color:
                        selected.type === "case_available"
                          ? "var(--brand)"
                          : undefined,
                    }}
                  >
                    <ListChecks size={14} />
                    {selected.type === "case_available"
                      ? "Open & Claim Case"
                      : "Open Case"}
                  </button>

                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400">
                    <CheckCircle2 size={14} />
                    Marked as read
                  </span>
                </div>

                {selected.type === "crime_detected" && (
                  <p className="inline-flex items-center gap-1.5 text-[11px] text-amber-400">
                    <ShieldAlert size={13} />
                    Broadcast to all investigators — first to open claims the case.
                  </p>
                )}

                {selected.type === "case_available" && (
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    Open this case to claim it. If another investigator opens first, it leaves your list.
                  </p>
                )}

                {selected.type === "case_assigned" && (
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    This case is assigned to you.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getNotificationSource(notification) {
  const sourceType = String(
    notification?.case?.history?.sourceType ||
      notification?.case?.history?.type ||
      ""
  )
    .trim()
    .toLowerCase();

  if (sourceType === "facebook") return "facebook";
  if (sourceType === "website") return "website";

  const matchType = notification?.case?.history?.blacklistMatches?.find(
    (match) => match?.type === "facebook_page" || match?.type === "website"
  )?.type;

  if (matchType === "facebook_page") return "facebook";
  if (matchType === "website") return "website";

  return "other";
}

function sourceLabel(source) {
  if (source === "facebook") return "Facebook";
  if (source === "website") return "Website";
  return "Other";
}

function mapNotification(notification) {
  return {
    _id: notification._id,
    notificationId: notification._id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    read: notification.read,
    case: notification.case || null,
    createdAt: notification.createdAt,
    source: getNotificationSource(notification),
  };
}

function formatDate(date) {
  if (!date) return "Just now";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
