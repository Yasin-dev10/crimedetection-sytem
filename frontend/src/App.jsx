import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useRef, useState } from "react";
import { useEffect } from "react";
import { getInitialTheme } from "./theme";
import API, { clearStoredSession } from "./api";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";

import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import ForgotPasswordPage from "./components/ForgotPasswordPage";

import Dashboard from "./page/Dashboard";
import PublicAnalysis from "./page/PublicAnalysis";
import UserManagement from "./page/UserManagement";
import ProfilePage from "./page/ProfilePage";
import SettingsPage from "./page/Setting";
import Blacklist from "./page/Blacklist";
import FakeCrimes from "./page/FakeCrimes";
import BareAIApp from "./page/BareAIApp";
import CaseManagement from "./page/CaseManagement";
import FacebookPosts from "./page/FacebookPosts";
import WebsitePages from "./page/WebsitePages";
import VerifyEmailPage from "./page/VerifyEmailPage";
import ChangePasswordPage from "./page/ChangePasswordPage";
import Reports from "./page/Reports";
import AuditLogs from "./page/AuditLogs";

const homeByRole = {
  admin: "/dashboard",
  investigator: "/cases",
  user: "/analysis",
};

function getStoredSession() {
  try {
    return {
      token: localStorage.getItem("token"),
      user: JSON.parse(localStorage.getItem("user") || "null"),
    };
  } catch {
    clearStoredSession();
    return { token: null, user: null };
  }
}

function Protected({ children, roles }) {
  const { token, user } = getStoredSession();
  const location = useLocation();
  const initialUserRef = useRef(user);
  const [sessionUser, setSessionUser] = useState(user);
  const [checkingSession, setCheckingSession] = useState(Boolean(token));
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 1024px)").matches;
  });
  const [, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const syncTheme = (e) => setTheme(e.detail?.theme || getInitialTheme());
    window.addEventListener("themechange", syncTheme);
    return () => window.removeEventListener("themechange", syncTheme);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      return () => {
        cancelled = true;
      };
    }

    API.get("/auth/me")
      .then((res) => {
        if (cancelled) return;
        const freshUser = res.data?.user;
        if (!freshUser) return;

        const normalizedUser = {
          ...initialUserRef.current,
          ...freshUser,
          id: freshUser.id || freshUser._id || initialUserRef.current?.id,
        };

        localStorage.setItem("user", JSON.stringify(normalizedUser));
        setSessionUser(normalizedUser);
      })
      .catch(() => {
        if (!cancelled) {
          setSessionUser(initialUserRef.current);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingSession(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const activeUser = sessionUser || user;

  if (!activeUser?.role) {
    clearStoredSession();
    return <Navigate to="/login" replace />;
  }

  if (checkingSession) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}
      >
        <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "var(--border-base)" }}>
          Checking account access...
        </div>
      </div>
    );
  }

  if (activeUser.isPasswordChangeRequired) {
    return (
      <Navigate
        to="/change-password"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (roles && !roles.includes(activeUser?.role)) {
    return (
      <Navigate
        to={homeByRole[activeUser?.role] || "/analysis"}
        replace
      />
    );
  }

  return (
    <div
      className="min-h-screen font-sans transition-colors duration-300"
      style={{
        backgroundColor: "var(--bg-base)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${
          sidebarOpen ? "visible opacity-100" : "invisible opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
      />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div
        className={`min-h-screen transition-[margin] duration-300 ease-out ${
          sidebarOpen ? "lg:ml-[288px]" : "lg:ml-20"
        }`}
      >
        <TopBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />
        <main
          className="app-main w-full overflow-x-hidden py-4 pl-3 pr-4 md:py-5 md:pl-4 md:pr-5 transition-colors duration-300"
          style={{
            backgroundColor: "var(--bg-base)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-sans)",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Public */}
        <Route path="/" element={<BareAIApp />} />
        <Route path="/analysis" element={<PublicAnalysis />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* My Dashboard – all roles
        <Route
          path="/my-dashboard"
          element={
            <Protected roles={["admin", "investigator", "user"]}>
              <MyDashboard />
            </Protected>
          }
        /> */}

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            <Protected roles={["admin"]}>
              <Dashboard />
            </Protected>
          }
        />

        {/* History merged into Reports */}
        <Route path="/history" element={<Navigate to="/reports" replace />} />

        {/* Users */}
        <Route
          path="/users"
          element={
            <Protected roles={["admin"]}>
              <UserManagement />
            </Protected>
          }
        />

        {/* Blacklist */}
        <Route
          path="/blacklist"
          element={
            <Protected roles={["admin", "investigator"]}>
              <Blacklist />
            </Protected>
          }
        />

        {/* Fake Crimes — static path before dynamic facebook posts */}
        <Route
          path="/blacklist/fake-crimes"
          element={
            <Protected roles={["admin", "investigator"]}>
              <FakeCrimes />
            </Protected>
          }
        />

        {/* Facebook Posts */}
        <Route
          path="/blacklist/facebook/:id/posts"
          element={
            <Protected roles={["admin", "investigator"]}>
              <FacebookPosts />
            </Protected>
          }
        />

        {/* Website Pages */}
        <Route
          path="/blacklist/website/:id/pages"
          element={
            <Protected roles={["admin", "investigator"]}>
              <WebsitePages />
            </Protected>
          }
        />

        {/* Case Management */}
        <Route
          path="/cases"
          element={
            <Protected roles={["admin", "investigator"]}>
              <CaseManagement />
            </Protected>
          }
        />
        <Route
          path="/investigator"
          element={<Navigate to="/cases" replace />}
        />

        {/* Notifications — TopBar panel only; keep routes as redirects */}
        <Route
          path="/notifications"
          element={<Navigate to="/cases" replace />}
        />
        <Route
          path="/notifications/history"
          element={<Navigate to="/cases" replace />}
        />

        {/* Profile */}
        <Route
          path="/profile"
          element={
            <Protected roles={["admin", "investigator", "user"]}>
              <ProfilePage />
            </Protected>
          }
        />

        {/* Settings */}
        <Route
          path="/settings"
          element={
            <Protected roles={["admin", "investigator"]}>
              <SettingsPage />
            </Protected>
          }
        />

        {/* Email Verification */}
        <Route path="/verify-email" element={<VerifyEmailPage />} />

        {/* Change Password */}
        <Route path="/change-password" element={<ChangePasswordPage />} />

        {/* Reports */}
        <Route
          path="/reports"
          element={
            <Protected roles={["admin", "investigator"]}>
              <Reports />
            </Protected>
          }
        />

        {/* Audit Logs */}
        <Route
          path="/audit-logs"
          element={
            <Protected roles={["admin", "investigator"]}>
              <AuditLogs />
            </Protected>
          }
        />

        {/* 404 */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}
