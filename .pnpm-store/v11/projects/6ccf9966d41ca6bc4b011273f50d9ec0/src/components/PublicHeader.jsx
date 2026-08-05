import { LogIn, Menu, Shield, UserPlus, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState } from "react";
import API, { clearStoredSession } from "../api";
import { getStoredUser } from "../theme";

const homeByRole = {
  admin: "/dashboard",
  investigator: "/cases",
  user: "/analysis",
};

export default function PublicHeader({ active = "home" }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const user = getStoredUser();
  const workspacePath = homeByRole[user?.role] || "/analysis";

  const navItems = [
    { label: "Analysis", href: "/analysis", key: "analysis" },
    { label: "Platform", href: "/#platform", key: "platform" },
    { label: "Workflow", href: "/#workflow", key: "workflow" },
    { label: "Team", href: "/#team", key: "team" },
  ];

  const logout = async () => {
    try {
      await API.post("/auth/logout");
    } catch {
      // Best-effort: always clear local session even if the request fails.
    } finally {
      clearStoredSession();
      window.location.assign("/");
    }
  };

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#cbd5e1] bg-white/92 text-[#0f172a] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <NavLink to="/" className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-900">
            <Shield className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-black tracking-tight">BAREAI</span>
            <span className="block truncate text-[11px] font-bold uppercase tracking-[0.16em] text-blue-900">
              Crime Intelligence Platform
            </span>
          </span>
        </NavLink>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {navItems.map((item) => {
            const isActive = active === item.key;
            const className = `rounded-lg px-3 py-2 text-sm font-semibold transition hover:bg-[#e8eef5] hover:text-[#0f172a] ${
              isActive ? "bg-[#e8eef5] text-[#0f172a]" : "text-[#64748b]"
            }`;

            if (item.href.startsWith("/#") || item.href === "/") {
              return (
                <a key={item.key} href={item.href} className={className}>
                  {item.label}
                </a>
              );
            }

            return (
              <NavLink key={item.key} to={item.href} className={className}>
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {user.role === "user" && (
                <NavLink
                  to="/analysis"
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-[#64748b] transition hover:bg-[#e8eef5]"
                >
                  Analysis
                </NavLink>
              )}
              {(user.role === "admin" || user.role === "investigator") && (
                <NavLink
                  to={workspacePath}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-[#64748b] transition hover:bg-[#e8eef5]"
                >
                  Workspace
                </NavLink>
              )}
              <NavLink
                to="/profile"
                className="rounded-lg px-3 py-2 text-sm font-semibold text-[#64748b] transition hover:bg-[#e8eef5]"
              >
                Profile
              </NavLink>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-[#cbd5e1] px-4 py-2 text-sm font-bold text-[#0f172a] transition hover:bg-[#e8eef5]"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#64748b] transition hover:bg-[#e8eef5]"
              >
                <LogIn className="h-4 w-4" />
                Log in
              </NavLink>
              <NavLink
                to="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#2563eb]"
              >
                <UserPlus className="h-4 w-4" />
                Register
              </NavLink>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#cbd5e1] text-[#0f172a] md:hidden"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-[#cbd5e1] bg-white px-4 py-4 md:hidden">
          <div className="grid gap-2">
            {navItems.map((item) => {
              const className = "rounded-lg px-3 py-2 text-sm font-semibold text-[#64748b] hover:bg-[#e8eef5]";
              if (item.href.startsWith("/#") || item.href === "/") {
                return (
                  <a
                    key={item.key}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={className}
                  >
                    {item.label}
                  </a>
                );
              }
              return (
                <NavLink
                  key={item.key}
                  to={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={className}
                >
                  {item.label}
                </NavLink>
              );
            })}

            {user ? (
              <div className="mt-2 grid gap-2">
                {user.role === "user" && (
                  <NavLink
                    to="/analysis"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg border border-[#cbd5e1] px-3 py-2 text-center text-sm font-semibold"
                  >
                    Analysis
                  </NavLink>
                )}
                {(user.role === "admin" || user.role === "investigator") && (
                  <NavLink
                    to={workspacePath}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-lg border border-[#cbd5e1] px-3 py-2 text-center text-sm font-semibold"
                  >
                    Workspace
                  </NavLink>
                )}
                <NavLink
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg border border-[#cbd5e1] px-3 py-2 text-center text-sm font-semibold"
                >
                  Profile
                </NavLink>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-xl bg-[#1e3a8a] px-3 py-2 text-sm font-bold text-white"
                >
                  Log out
                </button>
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <NavLink
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#cbd5e1] px-3 py-2 text-sm font-semibold text-[#0f172a]"
                >
                  <LogIn className="h-4 w-4" />
                  Log in
                </NavLink>
                <NavLink
                  to="/register"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e3a8a] px-3 py-2 text-sm font-bold text-white"
                >
                  <UserPlus className="h-4 w-4" />
                  Register
                </NavLink>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
