import { Shield } from "lucide-react";
import { NavLink } from "react-router-dom";

export default function PublicFooter() {
  const year = new Date().getFullYear();

  const links = [
    { label: "Home", to: "/" },
    { label: "Analysis", to: "/analysis" },
    { label: "Platform", to: "/#platform" },
    { label: "Workflow", to: "/#workflow" },
    { label: "Team", to: "/#team" },
  ];

  return (
    <footer className="border-t border-[#cbd5e1] bg-[#0a0d14] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-400/15 text-blue-200">
              <Shield className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-black tracking-tight">BAREAI</p>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-200">
                Crime Intelligence Platform
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
            AI-assisted analysis and investigation tools for monitoring crime-related
            signals, reviewing reports, and supporting secure case operations.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">
              Navigate
            </p>
            <ul className="mt-4 space-y-2.5">
              {links.map((link) => (
                <li key={link.label}>
                  <NavLink
                    to={link.to}
                    className="text-sm font-semibold text-slate-300 transition hover:text-white"
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">
              Access
            </p>
            <ul className="mt-4 space-y-2.5">
              <li>
                <NavLink
                  to="/login"
                  className="text-sm font-semibold text-slate-300 transition hover:text-white"
                >
                  Sign in
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/register"
                  className="text-sm font-semibold text-slate-300 transition hover:text-white"
                >
                  Create account
                </NavLink>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {year} BAREAI. All rights reserved.</p>
          <p>Authorized use only · Role-based secure access</p>
        </div>
      </div>
    </footer>
  );
}
