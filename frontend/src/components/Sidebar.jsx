import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  UserCircle,
  Settings,
  ListChecks,
  ShieldAlert,
  LogOut,
  BrainCircuit,
  FileBarChart2,
  Shield,
  ScrollText,
  History,
  Database,
} from "lucide-react";
import { useEffect, useState } from "react";
import API, { clearStoredSession } from "../api";
import { applyTheme, getInitialTheme, getStoredUser } from "../theme";

const menu = [
  {
    title: "Menu",
    items: [
      { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard, roles: ["admin", "user"] },
      { name: "Dataset Manager", path: "/dataset", icon: Database, roles: ["dataset_manager"] },
      { name: "User Management", path: "/users", icon: Users, roles: ["admin"] },
      { name: "Blacklist Management", path: "/blacklist", icon: ShieldAlert, roles: ["admin", "investigator"] },
      { name: "Case Management", path: "/cases", icon: ListChecks, roles: ["admin", "investigator"] },
      { name: "Analysis", path: "/workspace/analysis", icon: BrainCircuit, roles: ["user"] },
      { name: "History", path: "/history", icon: History, roles: ["user"] },
      { name: "Reports", path: "/reports", icon: FileBarChart2, roles: ["admin", "investigator"] },
      { name: "Audit Logs", path: "/audit-logs", icon: ScrollText, roles: ["admin"] },
      { name: "Profile", path: "/profile", icon: UserCircle, roles: ["admin", "investigator", "dataset_manager", "user"] },
      { name: "Settings", path: "/settings", icon: Settings, roles: ["admin", "investigator", "dataset_manager", "user"] },
    ],
  },
];

export default function Sidebar({ isOpen = true, onClose }) {
  const navigate = useNavigate();
  const storedUser = getStoredUser();
  const role = storedUser?.role || "user";
  const [theme, setTheme] = useState(getInitialTheme);

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

  const logout = async () => {
    try {
      await API.post("/auth/logout");
    } catch {
      // Best-effort: always clear local session even if the request fails.
    } finally {
      clearStoredSession();
      navigate("/login");
    }
  };

  const closeIfMobile = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      onClose?.();
    }
  };

  return (
    <aside
      className={`app-sidebar fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r transition-all duration-300 ease-out ${
        isOpen
          ? "w-[288px] translate-x-0"
          : "w-[288px] -translate-x-full lg:w-20 lg:translate-x-0"
      }`}
      style={{
        backgroundColor: "var(--bg-surface)",
        borderColor: "var(--border-base)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        className={`flex h-16 items-center border-b ${
          isOpen ? "gap-3 px-4" : "justify-center px-2"
        }`}
        style={{ borderColor: "var(--border-base)" }}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: "var(--brand)", color: "#ffffff" }}
          title="BAREAI"
        >
          <Shield size={20} strokeWidth={2.25} />
        </span>
        {isOpen && (
          <div className="min-w-0">
            <p className="truncate text-lg font-extrabold tracking-tight">BAREAI</p>
            <p
              className="truncate text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{ color: "var(--text-muted)" }}
            >
              Intelligence Platform
            </p>
          </div>
        )}
      </div>

      <nav className={`flex-1 overflow-y-auto py-6 ${isOpen ? "space-y-6 px-4" : "px-2"}`}>
        {menu.map((section) => {
          const visibleItems = section.items.filter((item) =>
            item.roles.includes(role)
          );
          if (!visibleItems.length) return null;

          return (
            <div key={section.title}>
              {isOpen && (
                <p
                  className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.12em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {section.title}
                </p>
              )}

              <ul className={`space-y-2.5 ${isOpen ? "" : "flex flex-col items-center gap-2.5"}`}>
                {visibleItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <li key={item.name} className={isOpen ? "" : "w-full"}>
                      <NavLink
                        to={item.path}
                        onClick={closeIfMobile}
                        title={item.name}
                        className={({ isActive }) =>
                          `flex items-center rounded-xl text-sm transition ${
                            isOpen
                              ? "gap-3 px-3.5 py-3"
                              : "mx-auto h-11 w-11 justify-center px-0"
                          } ${
                            isActive
                              ? "font-semibold sidebar-link-active"
                              : "font-medium sidebar-link"
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon size={18} strokeWidth={isActive ? 2.25 : 2} />
                            {isOpen && <span className="flex-1">{item.name}</span>}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div
        className={`border-t ${isOpen ? "p-4" : "flex justify-center p-3"}`}
        style={{ borderColor: "var(--border-base)" }}
      >
        <button
          type="button"
          onClick={logout}
          title="Logout"
          className={`flex items-center rounded-xl text-sm font-semibold text-red-500 transition hover:bg-red-500/10 ${
            isOpen
              ? "w-full gap-3 px-3 py-2.5"
              : "h-11 w-11 justify-center"
          }`}
        >
          <LogOut size={18} />
          {isOpen && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
