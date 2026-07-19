import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Moon, Sun, Shield } from "lucide-react";
import API from "../api";
import { applyTheme, getInitialTheme, getStoredUser } from "../theme";
import NotificationPanel from "./NotificationPanel";
import MenuToggle from "./MenuToggle";

const homeByRole = {
  admin: "/dashboard",
  investigator: "/cases",
  user: "/analysis",
};

export default function TopBar({ sidebarOpen = false, onToggleSidebar }) {
  const navigate = useNavigate();
  const storedUser = getStoredUser();
  const userName = storedUser?.name || "User";
  const userRole = storedUser?.role || "user";

  const [theme, setTheme] = useState(getInitialTheme);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    applyTheme(theme, { emit: false });
  }, [theme]);

  useEffect(() => {
    const syncTheme = (event) => {
      setTheme(event.detail?.theme || getInitialTheme());
    };

    window.addEventListener("themechange", syncTheme);
    window.addEventListener("storage", syncTheme);

    return () => {
      window.removeEventListener("themechange", syncTheme);
      window.removeEventListener("storage", syncTheme);
    };
  }, []);

  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const res = await API.get("/notifications/unread-count");
        setUnreadCount(res.data.count || 0);
      } catch {
        setUnreadCount(0);
      }
    };

    if (localStorage.getItem("token")) loadUnreadCount();

    window.addEventListener("notifications:read", loadUnreadCount);
    window.addEventListener("focus", loadUnreadCount);
    const interval = setInterval(loadUnreadCount, 15000);

    return () => {
      window.removeEventListener("notifications:read", loadUnreadCount);
      window.removeEventListener("focus", loadUnreadCount);
      clearInterval(interval);
    };
  }, []);

  const isLight = theme === "light";

  const toggleTheme = async () => {
    const nextTheme = isLight ? "dark" : "light";
    const appliedTheme = applyTheme(nextTheme, { updateUser: true });
    setTheme(appliedTheme);

    try {
      await API.patch("/auth/me", { theme: appliedTheme });
    } catch {
      // Keep local preference even if profile update fails.
    }
  };

  const canSeeNotifications =
    userRole === "admin" || userRole === "investigator";

  return (
    <header
      className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b px-3 sm:px-4 lg:px-5"
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border-base)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Mobile (sidebar hidden): Logo + BAREAI + toggle. Desktop: toggle only. */}
      <div className="flex min-w-0 items-center gap-3">
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => navigate(homeByRole[userRole] || "/analysis")}
            className="flex min-w-0 items-center gap-2.5 sm:gap-3 lg:hidden"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10 sm:rounded-xl"
              style={{ backgroundColor: "var(--brand)", color: "#ffffff" }}
            >
              <Shield size={18} strokeWidth={2.25} />
            </span>
            <span className="truncate text-base font-extrabold tracking-tight sm:text-lg">
              BAREAI
            </span>
          </button>
        )}

        {typeof onToggleSidebar === "function" && (
          <MenuToggle open={sidebarOpen} onClick={onToggleSidebar} />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {canSeeNotifications && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setPanelOpen((open) => !open)}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border transition hover:opacity-90"
              style={{
                backgroundColor: panelOpen
                  ? "var(--brand-soft)"
                  : "var(--bg-elevated)",
                borderColor: panelOpen ? "var(--brand-ring)" : "var(--border-base)",
                color: panelOpen ? "var(--brand)" : "var(--text-secondary)",
              }}
              aria-label="Notifications"
              aria-expanded={panelOpen}
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            <NotificationPanel
              open={panelOpen}
              onClose={() => setPanelOpen(false)}
              onUnreadChange={setUnreadCount}
            />
          </div>
        )}

        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-xl border transition hover:opacity-90"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderColor: "var(--border-base)",
            color: "var(--text-secondary)",
          }}
          aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
        >
          {isLight ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <button
          type="button"
          onClick={() => navigate("/profile")}
          className="flex max-w-[140px] items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition hover:opacity-90 sm:max-w-[220px] sm:px-2.5"
          style={{
            backgroundColor: "var(--bg-elevated)",
            borderColor: "var(--border-base)",
          }}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black uppercase"
            style={{
              backgroundColor: "var(--brand-soft)",
              color: "var(--brand)",
            }}
          >
            {userName.slice(0, 1)}
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-sm font-bold leading-tight">
              {userName}
            </span>
            <span
              className="block truncate text-[11px] capitalize leading-tight"
              style={{ color: "var(--text-muted)" }}
            >
              {userRole}
            </span>
          </span>
        </button>
      </div>
    </header>
  );
}
