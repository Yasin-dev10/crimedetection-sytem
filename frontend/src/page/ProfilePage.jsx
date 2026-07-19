import React, { useEffect, useState } from "react";
import {
  BadgeCheck,
  Calendar,
  IdCard,
  Mail,
  Phone,
  ShieldCheck,
  UserCircle,
  Building2,
  Terminal,
  Activity,
  KeyRound,
  Lock,
} from "lucide-react";
import API from "../api";
import ChangePasswordModal from "../components/ChangePasswordModal";

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const fallbackUser = JSON.parse(localStorage.getItem("user") || "null");
  const token = localStorage.getItem("token");

  const getImageUrl = (image) => {
    if (!image) return null;
    if (image.startsWith("http")) return image;
    return `http://localhost:5000${image}`;
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await API.get("/auth/me");
        setProfile(res.data.user);
      } catch (err) {
        setProfile(fallbackUser);
        setError(err.response?.data?.message || "Failed to load profile data.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const user = profile || fallbackUser;
  const roleLabel = user?.role ? user.role.toUpperCase() : "USER";
  const avatar = getImageUrl(user?.profileImage);

  // Custom color per role for clearer security display
  const getRoleColor = (role) => {
    if (role === "admin") return "border-red-500/20 bg-red-500/10 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]";
    if (role === "investigator") return "border-amber-500/20 bg-amber-500/10 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]";
    return "border-cyan-500/20 bg-cyan-500/10 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.1)]";
  };

  return (
    <div
      className="w-full selection:bg-cyan-500 selection:text-slate-900 font-sans antialiased transition-colors duration-300"
      style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Main Content Area */}
      <div className="transition-all duration-300">
        <div className="max-w-6xl mx-auto space-y-8">
          
          {/* Top Header Section with Cyber HUD Style */}
          <div className="relative border-b border-slate-800/60 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-cyan-500 uppercase">
                <Terminal size={14} className="animate-pulse" />
                <span>Secure Terminal // Profile_Data</span>
              </div>
              <h1 className="page-title mt-1">
                User Authentication & Credentials
              </h1>
              <p className="page-subtitle font-medium">
                Official account information and security clearance levels in the system.
              </p>
            </div>
            
            {error && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-mono shadow-[0_0_15px_rgba(244,63,94,0.1)] animate-bounce">
                <Lock size={14} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(6,182,212,0.3)]"></div>
              <p className="text-xs font-mono text-cyan-500 tracking-widest uppercase animate-pulse">Decrypting profile...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Left Column: Avatar & Security Clearence */}
              <div className="lg:col-span-1 space-y-6">
                <div className="relative overflow-hidden card p-6 group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full pointer-events-none group-hover:bg-cyan-500/10 transition-all duration-500"></div>
                  
                  <div className="flex flex-col items-center text-center relative z-10">
                    <div className="relative p-1 rounded-2xl border border-[var(--border-base)] bg-[var(--bg-elevated)]">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={user?.name}
                          className="w-32 h-32 rounded-xl object-cover border border-slate-800"
                        />
                      ) : (
                        <div className="w-32 h-32 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                          <UserCircle size={64} className="text-slate-600 group-hover:text-cyan-500 transition-colors duration-300" />
                        </div>
                      )}
                      {/* Active Status Badge Indicator */}
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500 border-2 border-slate-950"></span>
                      </span>
                    </div>

                    <h2 className="text-xl font-bold tracking-tight text-slate-100 mt-6 group-hover:text-cyan-400 transition-colors duration-300">
                      {user?.name || "Anonymous Agent"}
                    </h2>
                    
                    <p className="text-xs font-mono text-slate-500 mt-1 tracking-wider uppercase">
                      ID: {user?._id?.substring(0, 12) || "TEMP-U-9023"}...
                    </p>

                    {/* Clearance Badges */}
                    <div className="w-full mt-6 space-y-2 pt-4 border-t border-slate-800/60">
                      <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-bold ${getRoleColor(user?.role)}`}>
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={14} />
                          <span>CLEARANCE LEVEL</span>
                        </div>
                        <span className="font-mono">{roleLabel}</span>
                      </div>

                      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-cyan-500/10 bg-cyan-500/5 text-cyan-400 text-xs font-bold shadow-[0_0_15px_rgba(6,182,212,0.05)]">
                        <div className="flex items-center gap-2">
                          <BadgeCheck size={14} />
                          <span>ACCOUNT STATUS</span>
                        </div>
                        <span className="font-mono uppercase text-[10px] tracking-wider bg-cyan-500/20 px-2 py-0.5 rounded-md border border-cyan-500/30">
                          {user?.status || "ACTIVE"}
                        </span>
                      </div>

                      {/* Email Verification Status */}
                      {user?.emailVerified !== undefined && (
                        <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-bold ${
                          user?.emailVerified
                            ? "border-cyan-500/10 bg-cyan-500/5 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.05)]"
                            : "border-amber-500/10 bg-amber-500/5 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.05)]"
                        }`}>
                          <div className="flex items-center gap-2">
                            <Mail size={14} />
                            <span>EMAIL VERIFIED</span>
                          </div>
                          <span className="font-mono uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-md border">
                            {user?.emailVerified ? "✓ YES" : "✗ PENDING"}
                          </span>
                        </div>
                      )}

                      {/* Password Change Required Status */}
                      {user?.isPasswordChangeRequired !== undefined && (
                        <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-bold ${
                          user?.isPasswordChangeRequired
                            ? "border-red-500/10 bg-red-500/5 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.05)] animate-pulse"
                            : "border-cyan-500/10 bg-cyan-500/5 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.05)]"
                        }`}>
                          <div className="flex items-center gap-2">
                            <KeyRound size={14} />
                            <span>PASSWORD CHANGE</span>
                          </div>
                          <span className="font-mono uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-md border">
                            {user?.isPasswordChangeRequired ? "⚠ REQUIRED" : "✓ OK"}
                          </span>
                        </div>
                      )}

                      {/* Change Password Button */}
                      {token && (
                        <button
                          onClick={() => setShowPasswordModal(true)}
                          className="w-full mt-4 px-3 py-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-bold hover:border-cyan-500/60 hover:bg-cyan-500/20 transition-all duration-300 shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                        >
                          🔐 Request Password Change
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Account Details & Permissions */}
              <div className="lg:col-span-2 space-y-6">
                {/* Information Grid Container */}
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-800/60">
                    <KeyRound size={18} className="text-cyan-500" />
                    <h3 className="text-lg font-bold tracking-tight text-slate-100">Encrypted Personnel Records</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard icon={Mail} label="Official Email" value={user?.email} />
                    <InfoCard icon={Phone} label="Secure Hotline" value={user?.phone || "Not Configured"} />
                    <InfoCard icon={IdCard} label="Badge Number" value={user?.badgeNumber || "Unassigned"} isCode />
                    <InfoCard icon={Building2} label="Assigned Station" value={user?.station || "HQ Operations"} />
                    <InfoCard icon={Calendar} label="Enlistment Date" value={formatDate(user?.createdAt)} />
                    <InfoCard icon={Activity} label="Network Role" value={`${roleLabel} ACCESS`} />
                  </div>
                </div>

                {/* System Access / Authorization Policy Box */}
                <div className="relative overflow-hidden card p-6">
                  <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500"></div>
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100 tracking-tight">System Access & Protocol Policy</h3>
                      <p className="text-sm text-slate-400 leading-relaxed mt-1.5 font-medium">
                        This account uses the modern <span className="text-cyan-400 font-semibold">RBAC (Role-Based Access Control)</span> approach.
                        Your system access is limited by your security level:
                      </p>
                      <ul className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-mono text-slate-400">
                        <li className="flex items-center gap-1.5 border border-slate-800 bg-slate-900/40 p-2 rounded-lg">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Admin: Full Management
                        </li>
                        <li className="flex items-center gap-1.5 border border-slate-800 bg-slate-900/40 p-2 rounded-lg">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Investigator: Logs & History
                        </li>
                        <li className="flex items-center gap-1.5 border border-slate-800 bg-slate-900/40 p-2 rounded-lg">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500"></span> User: Standard Profiles
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

        {showPasswordModal && (
          <ChangePasswordModal
            token={token}
            onClose={() => setShowPasswordModal(false)}
            userName={user?.name}
          />
        )}
        </div>
      </div>
    </div>
  );
}

{/* Redesigned sub-component */}
function InfoCard({ icon: Icon, label, value, isCode }) {
  return (
    <div
      className="group relative rounded-xl border border-slate-800/80 p-4 transition-all duration-300 hover:border-slate-700 hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
      style={{ backgroundColor: "var(--bg-card)" }}
    >
      <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 group-hover:text-slate-400 transition-colors duration-300">
        <Icon size={14} className="text-slate-500 group-hover:text-cyan-500 transition-colors duration-300" />
        {label}
      </div>
      <p className={`mt-2 text-sm font-semibold ${isCode ? 'font-mono text-cyan-400 tracking-md bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800 inline-block' : 'text-slate-200'}`}>
        {value || "Not Configured"}
      </p>
    </div>
  );
}
