import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Eye,
  ImagePlus,
  KeyRound,
  LayoutGrid,
  List,
  LogIn,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  RefreshCcw,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import API from '../api';

const getUserId = (user) => {
  const rawId = user?._id || user?.id;
  if (!rawId) return "";
  if (typeof rawId === "string") return rawId;
  if (rawId.$oid) return rawId.$oid;
  return String(rawId);
};

const isMongoObjectId = (value) => /^[a-f\d]{24}$/i.test(value || "");

const normalizeUser = (user) => {
  const userId = getUserId(user);
  return userId ? { ...user, _id: userId, id: userId } : user;
};

function RoleBadge({ role }) {
  const styles = {
    admin: { bg: 'rgba(139, 92, 246, 0.12)', color: '#a78bfa', border: 'rgba(139, 92, 246, 0.3)' },
    investigator: { bg: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' },
    user: { bg: 'rgba(100, 116, 139, 0.12)', color: '#94a3b8', border: 'rgba(100, 116, 139, 0.3)' },
  };
  const s = styles[role] || styles.user;
  return (
    <span
      className="inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: s.bg, color: s.color, borderColor: s.border }}
    >
      {role || 'user'}
    </span>
  );
}

function StatusDot({ verified }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: verified ? '#22c55e' : '#94a3b8' }}
      />
      {verified ? 'Active' : 'Pending'}
    </span>
  );
}

function formatFullDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return mins <= 1 ? 'Just now' : `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatFullDate(date);
}

function DetailInfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: 'var(--brand-soft)', color: 'var(--brand)' }}
      >
        <Icon size={16} strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {value || '—'}
        </p>
      </div>
    </div>
  );
}

function formatAccountStatus(status) {
  return (
    {
      active: 'Active',
      warning: 'Warning',
      under_review: 'Under Review',
      suspended: 'Suspended',
      blocked: 'Blocked',
    }[status] || status || 'Active'
  );
}

function UserDetailsView({
  user,
  getImageUrl,
  onBack,
  onEdit,
  onDelete,
  onVerifyOtp,
  onAddUser,
  onUpdateAccountStatus,
}) {
  const borderColor = 'var(--border-base)';
  const cardBg = 'var(--bg-card)';
  const muted = 'var(--text-muted)';
  const [sanctionStatus, setSanctionStatus] = useState(user.account_status || 'active');
  const [sanctionSaving, setSanctionSaving] = useState(false);

  useEffect(() => {
    setSanctionStatus(user.account_status || 'active');
  }, [user._id, user.account_status]);

  const roleTitle =
    user.role === 'admin'
      ? 'Administrator'
      : user.role === 'investigator'
        ? 'Investigator'
        : 'User';

  const metricCards = [
    {
      title: 'Role',
      value: user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—',
      icon: Shield,
      bar: '#8b5cf6',
      soft: 'rgba(139, 92, 246, 0.12)',
      iconColor: '#a78bfa',
    },
    {
      title: 'Account',
      value: formatAccountStatus(user.account_status),
      icon: LogIn,
      bar:
        user.account_status === 'blocked' || user.account_status === 'suspended'
          ? '#ef4444'
          : user.emailVerified
            ? '#10b981'
            : '#f59e0b',
      soft:
        user.account_status === 'blocked' || user.account_status === 'suspended'
          ? 'rgba(239, 68, 68, 0.12)'
          : user.emailVerified
            ? 'rgba(16, 185, 129, 0.12)'
            : 'rgba(245, 158, 11, 0.12)',
      iconColor:
        user.account_status === 'blocked' || user.account_status === 'suspended'
          ? '#f87171'
          : user.emailVerified
            ? '#34d399'
            : '#fbbf24',
    },
    {
      title: 'False Reports',
      value: String(user.false_report_count ?? 0),
      icon: Shield,
      bar: (user.false_report_count || 0) > 0 ? '#f97316' : '#3b82f6',
      soft:
        (user.false_report_count || 0) > 0
          ? 'rgba(249, 115, 22, 0.12)'
          : 'rgba(59, 130, 246, 0.12)',
      iconColor: (user.false_report_count || 0) > 0 ? '#fb923c' : '#60a5fa',
    },
  ];

  const overviewRows = [
    { label: 'Discipline Status', value: formatAccountStatus(user.account_status) },
    { label: 'System Status', value: user.status === 'inactive' ? 'Inactive' : 'Active' },
    { label: 'Flagged', value: user.is_flagged ? 'Yes' : 'No' },
    { label: 'False Report Count', value: String(user.false_report_count ?? 0) },
    { label: 'Email Verified', value: user.emailVerified ? 'Yes' : 'No — OTP pending' },
    { label: 'Password Change', value: user.isPasswordChangeRequired ? 'Required at next login' : 'Up to date' },
    { label: 'Badge Number', value: user.badgeNumber || '—' },
    { label: 'Station / Team', value: user.station || '—' },
    { label: 'Account Created', value: formatFullDate(user.createdAt) },
  ];

  const activity = [
    user.updatedAt && {
      title: 'Profile updated',
      time: formatRelativeTime(user.updatedAt),
      desc: 'Account profile or permissions were last modified.',
      icon: Pencil,
    },
    user.passwordChangedAt && {
      title: 'Changed password',
      time: formatRelativeTime(user.passwordChangedAt),
      desc: 'Security password refresh completed.',
      icon: RefreshCcw,
    },
    {
      title: 'Account created',
      time: formatRelativeTime(user.createdAt),
      desc: `${roleTitle} account was registered in the system.`,
      icon: UserPlus,
    },
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="text-xs font-medium" style={{ color: muted }}>
        Management <span className="mx-1.5 opacity-50">›</span>{' '}
        <span style={{ color: 'var(--text-secondary)' }}>User Details</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title" style={{ color: 'var(--text-primary)' }}>User Details</h1>
          <p className="page-subtitle mt-1 max-w-xl">
            Inspect account status, profile data, permissions, and recent activity for the selected staff member.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors"
            style={{
              borderColor,
              backgroundColor: cardBg,
              color: 'var(--text-secondary)',
            }}
          >
            <ArrowLeft size={16} />
            Back to Users
          </button>
          <button
            type="button"
            onClick={onAddUser}
            className="btn-primary inline-flex items-center gap-2 shadow-md"
          >
            <UserPlus size={18} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* Profile summary */}
        <div
          className="relative overflow-hidden rounded-2xl border p-5 sm:p-6 xl:col-span-8"
          style={{ backgroundColor: cardBg, borderColor, boxShadow: 'var(--shadow-card)' }}
        >
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="relative shrink-0">
              <img
                src={getImageUrl(user.profileImage)}
                alt={user.name}
                className="h-28 w-28 rounded-2xl object-cover sm:h-32 sm:w-32"
                style={{ boxShadow: `0 0 0 3px ${borderColor}` }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    {user.name}
                  </h2>
                  <p className="mt-1 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {roleTitle}
                    {user.badgeNumber ? ` · Badge ${user.badgeNumber}` : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold"
                      style={{
                        color: user.emailVerified ? '#16a34a' : '#d97706',
                        backgroundColor: user.emailVerified ? 'rgba(34, 197, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                        borderColor: user.emailVerified ? 'rgba(34, 197, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                      }}
                    >
                      {user.emailVerified ? 'Active Account' : 'Pending Verification'}
                    </span>
                    <RoleBadge role={user.role} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(user)}
                  className="p-2 transition-all hover:opacity-70 hover:scale-110"
                  style={{ color: 'var(--brand)' }}
                  title="Edit user"
                >
                  <Pencil size={16} />
                </button>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <DetailInfoItem icon={Mail} label="Email" value={user.email} />
                <DetailInfoItem icon={Phone} label="Phone" value={user.phone || 'No phone'} />
                <DetailInfoItem icon={Building2} label="Team / Station" value={user.station || 'Not assigned'} />
                <DetailInfoItem icon={MapPin} label="Badge" value={user.badgeNumber || 'Not set'} />
              </div>

              {!user.emailVerified && (
                <button
                  type="button"
                  onClick={() => onVerifyOtp(user)}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                  style={{ backgroundColor: 'var(--brand)' }}
                >
                  <KeyRound size={16} /> Verify OTP
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Metric cards */}
        <div className="flex flex-col gap-3 xl:col-span-4">
          {metricCards.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="relative overflow-hidden rounded-2xl border px-4 py-3.5"
                style={{ backgroundColor: cardBg, borderColor, boxShadow: 'var(--shadow-card)' }}
              >
                <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: item.bar }} />
                <div className="flex items-center justify-between gap-2 pl-1.5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>
                      {item.title}
                    </p>
                    <p className="mt-1 text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
                      {item.value}
                    </p>
                  </div>
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: item.soft, color: item.iconColor }}
                  >
                    <Icon size={16} strokeWidth={2.25} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Account overview */}
        <div
          className="rounded-2xl border p-5 xl:col-span-5"
          style={{ backgroundColor: cardBg, borderColor, boxShadow: 'var(--shadow-card)' }}
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Account Overview</h3>
            <button
              type="button"
              onClick={() => onEdit(user)}
              className="text-sm font-semibold"
              style={{ color: 'var(--brand)' }}
            >
              Edit User
            </button>
          </div>
          <div className="space-y-2.5">
            {overviewRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-soft)',
                }}
              >
                <span className="text-xs font-semibold" style={{ color: muted }}>{row.label}</span>
                <span className="text-right text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onDelete(user)}
            className="mt-5 inline-flex items-center gap-2 rounded-xl border border-red-500/25 px-3 py-2 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/10"
          >
            <Trash2 size={15} /> Delete User
          </button>
        </div>

        {user.role === 'user' && (
          <div
            className="rounded-2xl border p-5 xl:col-span-12"
            style={{ backgroundColor: cardBg, borderColor, boxShadow: 'var(--shadow-card)' }}
          >
            <h3 className="mb-1 text-base font-bold" style={{ color: 'var(--text-primary)' }}>
              False Report Sanctions
            </h3>
            <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
              False-report flags apply sanctions automatically by policy. Admins can still adjust account status here.
              Policy: 1 = Warning · 2 = Under review · 3 = Suspended · 5 = Blocked.
            </p>

            {user.flag_reason && (
              <div
                className="mb-4 rounded-xl border px-3.5 py-3 text-sm"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  borderColor: 'var(--border-soft)',
                  color: 'var(--text-secondary)',
                }}
              >
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Latest flag reason:{' '}
                </span>
                {user.flag_reason}
                {user.flagged_by?.name && (
                  <span className="mt-1 block text-xs" style={{ color: muted }}>
                    Flagged by {user.flagged_by.name}
                    {user.flagged_at ? ` · ${formatFullDate(user.flagged_at)}` : ''}
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide" style={{ color: muted }}>
                  Account status
                </label>
                <select
                  value={sanctionStatus}
                  onChange={(e) => setSanctionStatus(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2.5 text-sm font-semibold"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-soft)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <option value="active">Active</option>
                  <option value="warning">Warning</option>
                  <option value="under_review">Under Review</option>
                  <option value="suspended">Temporary Suspension</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
              <button
                type="button"
                disabled={sanctionSaving || !onUpdateAccountStatus}
                onClick={async () => {
                  if (!onUpdateAccountStatus) return;
                  setSanctionSaving(true);
                  try {
                    await onUpdateAccountStatus(user, sanctionStatus);
                  } finally {
                    setSanctionSaving(false);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: 'var(--brand)' }}
              >
                <Shield size={16} />
                {sanctionSaving ? 'Saving…' : 'Apply Sanction'}
              </button>
            </div>
          </div>
        )}

        {/* Recent activity */}
        <div
          className="rounded-2xl border p-5 xl:col-span-7"
          style={{ backgroundColor: cardBg, borderColor, boxShadow: 'var(--shadow-card)' }}
        >
          <h3 className="mb-5 text-base font-bold" style={{ color: 'var(--text-primary)' }}>Recent Activity</h3>
          <div className="relative space-y-0 pl-2">
            <div
              className="absolute bottom-3 left-[19px] top-3 w-px"
              style={{ backgroundColor: 'var(--brand-soft)' }}
            />
            {activity.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={`${item.title}-${idx}`} className="relative flex gap-4 pb-6 last:pb-0">
                  <span
                    className="relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
                    style={{
                      backgroundColor: 'var(--brand-soft)',
                      borderColor: 'var(--brand-ring)',
                      color: 'var(--brand)',
                    }}
                  >
                    <Icon size={14} strokeWidth={2.25} />
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                      <span className="text-xs font-medium" style={{ color: muted }}>{item.time}</span>
                    </div>
                    <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const [viewType, setViewType] = useState('table');
  const [roleTab, setRoleTab] = useState('all');
  const [search, setSearch] = useState('');
  const [detailUserId, setDetailUserId] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [otpTarget, setOtpTarget] = useState(null);
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpNotice, setOtpNotice] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [addPendingUser, setAddPendingUser] = useState(null);
  const [addOtpValue, setAddOtpValue] = useState('');
  const [addOtpNotice, setAddOtpNotice] = useState('');
  const [addOtpError, setAddOtpError] = useState('');
  const [sendingAddOtp, setSendingAddOtp] = useState(false);
  const [verifyingAddOtp, setVerifyingAddOtp] = useState(false);

  const emptyForm = { name: '', email: '', badgeNumber: '', station: '', phone: '', profileImage: null };
  const [newUser, setNewUser] = useState(emptyForm);
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', badgeNumber: '', station: '', phone: '', profileImage: null });

  const summary = useMemo(() => {
    const total = users.length;
    const verified = users.filter((u) => u.emailVerified).length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const pending = users.filter((u) => !u.emailVerified).length;
    const flagged = users.filter((u) => u.is_flagged || (u.false_report_count || 0) > 0).length;
    return { total, verified, admins, pending, flagged };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const roleOk =
        roleTab === 'all' ||
        (roleTab === 'admin' && u.role === 'admin') ||
        (roleTab === 'investigator' && u.role === 'investigator') ||
        (roleTab === 'user' && u.role === 'user');
      if (!roleOk) return false;
      if (!q) return true;
      return (
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.station?.toLowerCase().includes(q) ||
        u.badgeNumber?.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleTab]);

  const detailUser = useMemo(
    () => users.find((u) => getUserId(u) === detailUserId) || null,
    [users, detailUserId]
  );

  const borderColor = 'var(--border-base)';
  const cardBg = 'var(--bg-card)';
  const muted = 'var(--text-muted)';

  const defaultImage = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200';

  const getImageUrl = (image) => {
    if (!image) return defaultImage;
    if (image.startsWith('http')) return image;
    return `http://localhost:5000${image}`;
  };

  const formatJoinedDate = (date) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');
      const res = await API.get('/users');
      setUsers((res.data || []).map(normalizeUser));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  // ── ADD ───────────────────────────────────────────────────────────────────
  const openOtpModal = (user, notice = '') => {
    setOtpTarget(user);
    setOtpValue('');
    setOtpError('');
    setOtpNotice(notice);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpTarget?.email) return;
    if (otpValue.trim().length !== 6) {
      setOtpError('Enter the 6-digit OTP code.');
      return;
    }

    try {
      setVerifyingOtp(true);
      setOtpError('');
      setOtpNotice('');

      const res = await API.post('/auth/verify-otp', {
        email: otpTarget.email,
        otp: otpValue.trim(),
      });

      setUsers((prev) => prev.map((user) => (
        user.email === otpTarget.email
          ? { ...user, emailVerified: true, isPasswordChangeRequired: true }
          : user
      )));

      setSuccessMessage(res.data.message || 'Email verified successfully. The investigator must set their own password at first login.');
      setOtpTarget(null);
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid or expired OTP code.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!otpTarget?.email) return;

    try {
      setResendingOtp(true);
      setOtpError('');
      setOtpNotice('');

      const res = await API.post('/auth/resend-otp', { email: otpTarget.email });
      setOtpValue('');
      setOtpNotice(res.data.message || 'A new verification code has been sent.');
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Failed to resend OTP code.');
    } finally {
      setResendingOtp(false);
    }
  };

  const resetAddVerification = () => {
    setAddPendingUser(null);
    setAddOtpValue('');
    setAddOtpNotice('');
    setAddOtpError('');
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setError('');
    setNewUser(emptyForm);
    resetAddVerification();
  };

  const upsertUser = (nextUser) => {
    const nextUserId = getUserId(nextUser);
    setUsers((prev) => {
      const existingIndex = prev.findIndex((user) => getUserId(user) === nextUserId);
      if (existingIndex === -1) return [nextUser, ...prev];

      return prev.map((user) => getUserId(user) === nextUserId ? nextUser : user);
    });
  };

  const handleSendAddOtp = async () => {
    if (!newUser.name || !newUser.email) return;
    try {
      setSendingAddOtp(true);
      setError('');
      setSuccessMessage('');
      setAddOtpError('');
      const formData = new FormData();
      formData.append('name', newUser.name);
      formData.append('email', newUser.email);
      formData.append('badgeNumber', newUser.badgeNumber);
      formData.append('station', newUser.station);
      formData.append('phone', newUser.phone);
      if (newUser.profileImage) formData.append('profileImage', newUser.profileImage);

      const res = await API.post('/users/create-investigator', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const createdUser = normalizeUser(res.data.user);
      upsertUser(createdUser);
      setAddPendingUser(createdUser);
      setAddOtpValue('');
      setAddOtpNotice(res.data.message || 'Enter the OTP sent to the user email.');
    } catch (err) {
      setAddOtpError(err.response?.data?.message || 'Failed to send OTP code.');
    } finally {
      setSendingAddOtp(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!addPendingUser?.email) {
      await handleSendAddOtp();
      return;
    }

    if (addOtpValue.trim().length !== 6) {
      setAddOtpError('Enter the 6-digit OTP code before saving.');
      return;
    }

    try {
      setVerifyingAddOtp(true);
      setAddOtpError('');
      setAddOtpNotice('');

      const res = await API.post('/auth/verify-otp', {
        email: addPendingUser.email,
        otp: addOtpValue.trim(),
      });

      setUsers((prev) => prev.map((user) => (
        user.email === addPendingUser.email
          ? { ...user, emailVerified: true, isPasswordChangeRequired: true }
          : user
      )));

      setSuccessMessage(res.data.message || 'Email verified successfully. The investigator must set their own password at first login.');
      closeAddModal();
    } catch (err) {
      setAddOtpError(err.response?.data?.message || 'Invalid or expired OTP code.');
    } finally {
      setVerifyingAddOtp(false);
    }
  };

  // ── EDIT ──────────────────────────────────────────────────────────────────
  const openEditModal = (user) => {
    setEditUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      badgeNumber: user.badgeNumber || '',
      station: user.station || '',
      phone: user.phone || '',
      profileImage: null,
    });
    setError('');
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccessMessage('');
      const formData = new FormData();
      formData.append('name', editForm.name);
      formData.append('email', editForm.email);
      formData.append('badgeNumber', editForm.badgeNumber);
      formData.append('station', editForm.station);
      formData.append('phone', editForm.phone);
      if (editForm.password.trim()) formData.append('password', editForm.password);
      if (editForm.profileImage) formData.append('profileImage', editForm.profileImage);

      const editUserId = getUserId(editUser);
      const res = await API.patch(`/users/${editUserId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUsers((prev) => prev.map((u) => getUserId(u) === editUserId ? normalizeUser(res.data.user) : u));
      setEditUser(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  // ── DELETE ────────────────────────────────────────────────────────────────
  const handleUpdateAccountStatus = async (user, account_status) => {
    try {
      setError('');
      setSuccessMessage('');
      const userId = getUserId(user);
      const res = await API.patch(`/users/${userId}/account-status`, {
        account_status,
        clearFlag: account_status === 'active',
      });
      const updated = normalizeUser(res.data.user);
      setUsers((prev) =>
        prev.map((u) => (getUserId(u) === userId ? updated : u))
      );
      setSuccessMessage(res.data.message || 'Account status updated.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update account status');
    }
  };

  // ── DELETE ────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const deleteTargetId = getUserId(deleteTarget);
    const deleteTargetEmail = deleteTarget.email?.trim().toLowerCase();
    const canDeleteById = isMongoObjectId(deleteTargetId);

    if (!canDeleteById && !deleteTargetEmail) {
      setError('Could not delete user because the user ID and email are missing. Please refresh and try again.');
      setDeleteTarget(null);
      return;
    }

    try {
      setError('');
      if (canDeleteById) {
        await API.delete(`/users/${deleteTargetId}`);
      } else {
        await API.delete(`/users/by-email/${encodeURIComponent(deleteTargetEmail)}`);
      }
      setUsers((prev) => prev.filter((u) => (
        canDeleteById
          ? getUserId(u) !== deleteTargetId
          : u.email?.trim().toLowerCase() !== deleteTargetEmail
      )));
      if (
        detailUserId &&
        (canDeleteById
          ? detailUserId === deleteTargetId
          : detailUser?.email?.trim().toLowerCase() === deleteTargetEmail)
      ) {
        setDetailUserId(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete user');
      setDeleteTarget(null);
    }
  };

  const summaryCards = [
    { title: 'Total Users', value: summary.total, icon: Users, bar: '#3b82f6', soft: 'rgba(59, 130, 246, 0.12)', iconColor: '#60a5fa' },
    { title: 'Active', value: summary.verified, icon: UserCheck, bar: '#10b981', soft: 'rgba(16, 185, 129, 0.12)', iconColor: '#34d399' },
    { title: 'Flagged', value: summary.flagged, icon: Shield, bar: '#f97316', soft: 'rgba(249, 115, 22, 0.12)', iconColor: '#fb923c' },
    { title: 'Pending', value: summary.pending, icon: MessageSquare, bar: '#f59e0b', soft: 'rgba(245, 158, 11, 0.12)', iconColor: '#fbbf24' },
  ];

  const roleTabs = [
    { id: 'all', label: 'All Users' },
    { id: 'admin', label: 'Administrators' },
    { id: 'investigator', label: 'Investigators' },
    { id: 'user', label: 'Users' },
  ];

  return (
    <div
      className="w-full transition-colors duration-300"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
    >
      {detailUser ? (
        <>
          {(error || successMessage) && (
            <div className="mx-auto mb-4 max-w-7xl">
              {error && <p className="text-sm text-red-400">{error}</p>}
              {successMessage && (
                <p className="text-sm" style={{ color: 'var(--brand)' }}>{successMessage}</p>
              )}
            </div>
          )}
          <UserDetailsView
            user={detailUser}
            getImageUrl={getImageUrl}
            onBack={() => setDetailUserId(null)}
            onEdit={openEditModal}
            onDelete={setDeleteTarget}
            onVerifyOtp={(u) => openOtpModal(u, 'Enter the OTP sent to this user email.')}
            onAddUser={() => { setError(''); setSuccessMessage(''); setIsAddModalOpen(true); }}
            onUpdateAccountStatus={handleUpdateAccountStatus}
          />
        </>
      ) : (
      <div className="mx-auto max-w-7xl space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="page-title" style={{ color: 'var(--text-primary)' }}>
              Users Management
            </h1>
            <p className="page-subtitle mt-1 max-w-xl">
              Manage team access, permissions, and monitor active account statuses.
            </p>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            {successMessage && (
              <p className="mt-2 text-sm" style={{ color: 'var(--brand)' }}>{successMessage}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setError(''); setSuccessMessage(''); setIsAddModalOpen(true); }}
            className="btn-primary inline-flex items-center gap-2 shadow-md"
          >
            <UserPlus size={18} />
            <span>Add User</span>
          </button>
        </div>

        {/* SUMMARY STATS */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summaryCards.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="relative overflow-hidden rounded-2xl border px-3.5 py-3.5"
                style={{
                  backgroundColor: cardBg,
                  borderColor,
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: item.bar }} />
                <div className="flex items-start justify-between gap-2 pl-1.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: muted }}>
                      {item.title}
                    </p>
                    <p className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight" style={{ color: 'var(--text-primary)' }}>
                      {loading ? '…' : item.value}
                    </p>
                  </div>
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: item.soft, color: item.iconColor }}
                  >
                    <Icon size={16} strokeWidth={2.25} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* TABLE / CARDS PANEL */}
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ backgroundColor: cardBg, borderColor, boxShadow: 'var(--shadow-card)' }}
        >
          <div
            className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            style={{ borderColor }}
          >
            <div className="flex flex-wrap gap-1">
              {roleTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoleTab(tab.id)}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
                  style={
                    roleTab === tab.id
                      ? { color: 'var(--brand)', backgroundColor: 'var(--brand-soft)' }
                      : { color: muted }
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="relative flex min-w-[200px] flex-1 items-center sm:max-w-xs"
              >
                <Search size={15} className="pointer-events-none absolute left-3" style={{ color: muted }} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users, roles, or teams..."
                  className="w-full rounded-xl border py-2 pl-9 pr-3 text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor,
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div
                className="flex rounded-xl border p-1"
                style={{ backgroundColor: 'var(--bg-elevated)', borderColor }}
              >
                <button
                  type="button"
                  onClick={() => setViewType('card')}
                  className="rounded-lg p-2 transition-all"
                  style={viewType === 'card' ? { backgroundColor: 'var(--brand)', color: '#fff' } : { color: muted }}
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewType('table')}
                  className="rounded-lg p-2 transition-all"
                  style={viewType === 'table' ? { backgroundColor: 'var(--brand)', color: '#fff' } : { color: muted }}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-sm" style={{ color: muted }}>Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: muted }}>
              No users match your filters.
            </div>
          ) : viewType === 'card' ? (
            <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredUsers.map((user) => (
                <div
                  key={getUserId(user) || user.email}
                  className="relative overflow-hidden rounded-2xl border p-5 transition-shadow"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-soft)',
                  }}
                >
                  <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: 'var(--brand)' }} />
                  <div className="absolute right-3 top-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailUserId(getUserId(user))}
                      className="p-1.5 transition-all hover:opacity-70 hover:scale-110"
                      style={{ color: 'var(--brand)' }}
                      title="View details"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(user)}
                      className="p-1.5 transition-all hover:opacity-70 hover:scale-110"
                      style={{ color: 'var(--brand)' }}
                      title="Edit user"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(user)}
                      className="p-1.5 transition-all hover:opacity-70 hover:scale-110"
                      style={{ color: 'var(--accent-danger)' }}
                      title="Delete user"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 pl-1">
                    <button
                      type="button"
                      onClick={() => setDetailUserId(getUserId(user))}
                      className="shrink-0"
                    >
                      <img
                        src={getImageUrl(user.profileImage)}
                        alt={user.name}
                        className="h-14 w-14 rounded-full object-cover"
                        style={{ boxShadow: `0 0 0 2px ${borderColor}` }}
                      />
                    </button>
                    <div className="min-w-0 pr-20">
                      <button
                        type="button"
                        onClick={() => setDetailUserId(getUserId(user))}
                        className="block w-full truncate text-left text-base font-bold hover:underline"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {user.name}
                      </button>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <RoleBadge role={user.role} />
                        <StatusDot verified={user.emailVerified} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 space-y-2.5 pl-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <div className="flex items-center gap-2"><Mail size={14} style={{ color: muted }} />{user.email}</div>
                    <div className="flex items-center gap-2"><Phone size={14} style={{ color: muted }} />{user.phone || 'No phone'}</div>
                    <div className="flex items-center gap-2"><Calendar size={14} style={{ color: muted }} />Joined: {formatJoinedDate(user.createdAt)}</div>
                  </div>
                  {!user.emailVerified && (
                    <button
                      type="button"
                      onClick={() => openOtpModal(user, 'Enter the OTP sent to this user email.')}
                      className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                      style={{ backgroundColor: 'var(--brand)' }}
                    >
                      <KeyRound size={16} /> Verify OTP
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${borderColor}`, color: muted }}>
                    <th className="px-5 py-3.5 pl-6 font-semibold">Name</th>
                    <th className="px-4 py-3.5 font-semibold">Role</th>
                    <th className="px-4 py-3.5 font-semibold">Status</th>
                    <th className="px-4 py-3.5 font-semibold">Email</th>
                    <th className="px-4 py-3.5 font-semibold">Phone</th>
                    <th className="px-4 py-3.5 font-semibold">Joined</th>
                    <th className="px-5 py-3.5 pr-6 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={getUserId(user) || user.email}
                      className="group transition-colors"
                      style={{ borderBottom: '1px solid var(--border-soft)' }}
                    >
                      <td className="px-5 py-3.5 pl-6">
                        <button
                          type="button"
                          onClick={() => setDetailUserId(getUserId(user))}
                          className="flex items-center gap-3 text-left"
                        >
                          <img
                            src={getImageUrl(user.profileImage)}
                            alt={user.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-semibold hover:underline" style={{ color: 'var(--text-primary)' }}>
                              {user.name}
                            </p>
                            <p className="truncate text-xs" style={{ color: muted }}>{user.email}</p>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3.5"><RoleBadge role={user.role} /></td>
                      <td className="px-4 py-3.5"><StatusDot verified={user.emailVerified} /></td>
                      <td className="px-4 py-3.5" style={{ color: 'var(--text-secondary)' }}>{user.email}</td>
                      <td className="px-4 py-3.5" style={{ color: 'var(--text-secondary)' }}>{user.phone || 'No phone'}</td>
                      <td className="px-4 py-3.5" style={{ color: muted }}>{formatJoinedDate(user.createdAt)}</td>
                      <td className="px-5 py-3.5 pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailUserId(getUserId(user))}
                            className="p-1.5 transition-all hover:opacity-70 hover:scale-110"
                            style={{ color: 'var(--brand)' }}
                            title="View details"
                          >
                            <Eye size={17} />
                          </button>
                          {!user.emailVerified && (
                            <button
                              type="button"
                              onClick={() => openOtpModal(user, 'Enter the OTP sent to this user email.')}
                              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90"
                              style={{ backgroundColor: 'var(--brand)' }}
                              title="Verify OTP"
                            >
                              <KeyRound size={13} /> Verify OTP
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            className="p-1.5 transition-all hover:opacity-70 hover:scale-110"
                            style={{ color: 'var(--brand)' }}
                            title="Edit user"
                          >
                            <Pencil size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(user)}
                            className="p-1.5 transition-all hover:opacity-70 hover:scale-110"
                            style={{ color: 'var(--accent-danger)' }}
                            title="Delete user"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                className="flex items-center justify-between border-t px-5 py-3 text-xs"
                style={{ borderColor, color: muted }}
              >
                <span>
                  Showing {filteredUsers.length} of {users.length} entries
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ADD MODAL */}
      {isAddModalOpen && (
        <UserFormModal
          title="Add New User"
          subtitle="A verification code and password will be sent to the user's email only."
          form={newUser} setForm={setNewUser} onSubmit={handleAddUser}
          onSendOtp={handleSendAddOtp}
          onClose={closeAddModal}
          saving={verifyingAddOtp} error={error} defaultImage={defaultImage}
          isEdit={false}
          pendingUser={addPendingUser}
          otpValue={addOtpValue}
          setOtpValue={setAddOtpValue}
          otpNotice={addOtpNotice}
          otpError={addOtpError}
          sendingOtp={sendingAddOtp}
          verifyingOtp={verifyingAddOtp}
        />
      )}

      {/* EDIT MODAL */}
      {editUser && (
        <UserFormModal
          title="Edit User"
          subtitle="Leave password blank to keep the current one."
          form={editForm} setForm={setEditForm} onSubmit={handleEditUser}
          onClose={() => { setEditUser(null); setError(''); }}
          saving={saving} error={error} defaultImage={defaultImage}
          currentImage={editUser.profileImage}
          isEdit={true}
          editingUser={editUser}
        />
      )}

      {/* OTP VERIFY MODAL */}
      {otpTarget && (
        <OtpVerificationModal
          user={otpTarget}
          otpValue={otpValue}
          setOtpValue={setOtpValue}
          onSubmit={handleVerifyOtp}
          onResend={handleResendOtp}
          onClose={() => setOtpTarget(null)}
          verifying={verifyingOtp}
          resending={resendingOtp}
          error={otpError}
          notice={otpNotice}
        />
      )}

      {/* DELETE CONFIRM */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-6 relative">
            <div className="modal-accent-top modal-accent-top--danger rounded-t-2xl" />
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <Trash2 size={22} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">Delete User</h2>
                <p className="text-xs text-slate-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 bg-slate-800/50 rounded-xl px-4 py-3 border border-slate-700/50 mb-6">
              Are you sure you want to delete <span className="font-semibold text-white">{deleteTarget.name}</span>?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-all text-sm font-medium">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-400 text-white font-bold rounded-xl transition-all text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── SHARED FORM MODAL ───────────────────────────────────────────────────── */
function OtpVerificationModal({
  user,
  otpValue,
  setOtpValue,
  onSubmit,
  onResend,
  onClose,
  verifying,
  resending,
  error,
  notice,
}) {
  const handleOtpChange = (value) => {
    setOtpValue(value.replace(/\D/g, '').slice(0, 6));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="h-[3px] bg-amber-500" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-all"
        >
          <X size={18} />
        </button>

        <form onSubmit={onSubmit} className="p-6 space-y-5">
          <div className="pr-8">
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
              <KeyRound size={22} className="text-amber-300" />
            </div>
            <h2 className="text-xl font-bold text-slate-100">Verify Email OTP</h2>
            <p className="text-xs text-slate-400 mt-1">
              Enter the 6-digit code for <span className="text-cyan-300 font-semibold">{user.email}</span>.
            </p>
          </div>

          {notice && (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2.5 text-xs text-cyan-300">
              {notice}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}

          <Field label="OTP Code">
            <input
              type="text"
              inputMode="numeric"
              autoFocus
              placeholder="Enter 6-digit OTP"
              value={otpValue}
              onChange={(e) => handleOtpChange(e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/60 rounded-xl px-4 py-3 text-center text-2xl tracking-[0.35em] font-black text-slate-100 focus:outline-none focus:border-cyan-500 transition-all"
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onResend}
              disabled={resending}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:border-cyan-500 hover:text-cyan-300 disabled:opacity-50"
            >
              <RefreshCcw size={15} /> {resending ? 'Sending...' : 'Resend OTP'}
            </button>
            <button
              type="submit"
              disabled={verifying || otpValue.length !== 6}
              className="flex-1 btn-primary justify-center"
            >
              {verifying ? 'Verifying...' : 'Verify'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserFormModal({
  title, subtitle, form, setForm, onSubmit,
  onClose, saving, error, defaultImage, currentImage, isEdit, editingUser,
  onSendOtp, pendingUser, otpValue, setOtpValue, otpNotice, otpError,
  sendingOtp, verifyingOtp,
}) {
  const previewSrc = form.profileImage
    ? URL.createObjectURL(form.profileImage)
    : currentImage
    ? (currentImage.startsWith('http') ? currentImage : `http://localhost:5000${currentImage}`)
    : defaultImage;

  const handleInlineOtpChange = (value) => {
    setOtpValue?.(value.replace(/\D/g, '').slice(0, 6));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
      {/* Modal: flex column so footer is always visible */}
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl relative flex flex-col max-h-[90vh]">

        {/* Top accent bar */}
        <div className="modal-accent-top rounded-t-2xl z-10 pointer-events-none" />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-all z-10"
        >
          <X size={18} />
        </button>

        {/* ── Scrollable body ── */}
        <div className="overflow-y-auto flex-1 px-6 pt-7 pb-2 min-h-0">

          {/* Header */}
          <div className="mb-5 pr-6">
            <h2 className="text-xl font-bold text-slate-100">{title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
            {error && (
              <p className="text-sm text-red-400 mt-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Status badges (edit only) */}
          {editingUser && (
            <div className="mb-5 space-y-2">
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-bold ${
                editingUser.emailVerified
                  ? 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400'
                  : 'border-amber-500/20 bg-amber-500/5 text-amber-400'
              }`}>
                <span>📧 Email Verified</span>
                <span className="font-mono uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-md border">
                  {editingUser.emailVerified ? '✓ YES' : '✗ PENDING'}
                </span>
              </div>
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-bold ${
                editingUser.isPasswordChangeRequired
                  ? 'border-red-500/20 bg-red-500/5 text-red-400'
                  : 'border-cyan-500/20 bg-cyan-500/5 text-cyan-400'
              }`}>
                <span>🔐 Password Status</span>
                <span className="font-mono uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-md border">
                  {editingUser.isPasswordChangeRequired ? '⚠ REQUIRED' : '✓ OK'}
                </span>
              </div>
            </div>
          )}

          {/* Form */}
          <form id="user-form" onSubmit={onSubmit} className="space-y-4 pb-2">
            {/* Profile Image */}
            <Field label="Profile Image">
              <label className="flex items-center gap-4 bg-slate-800/50 border border-dashed border-slate-700/80 rounded-xl p-3 cursor-pointer hover:border-cyan-500 transition-all">
                <img src={previewSrc} alt="Preview" className="w-14 h-14 rounded-full object-cover ring-1 ring-slate-700 shrink-0" />
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <ImagePlus size={18} className="text-cyan-400 shrink-0" />
                  <span className="truncate">{form.profileImage ? form.profileImage.name : 'Choose image'}</span>
                </div>
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => setForm({ ...form, profileImage: e.target.files?.[0] || null })} />
              </label>
            </Field>

            <Field label="Full Name">
              <input
                type="text" required placeholder="Enter Full Name" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-slate-800/50 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500 transition-all text-sm"
              />
            </Field>

            <Field label="Email">
              <input
                type="email" required placeholder="Enter email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-slate-800/50 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500 transition-all text-sm"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Badge Number">
                <input
                  type="text" placeholder="POL-001" value={form.badgeNumber || ''}
                  onChange={(e) => setForm({ ...form, badgeNumber: e.target.value })}
                  className="w-full bg-slate-800/50 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500 transition-all text-sm"
                />
              </Field>
              <Field label="Phone">
                <input
                  type="text" placeholder="+252 61..." value={form.phone || ''}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-slate-800/50 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500 transition-all text-sm"
                />
              </Field>
            </div>

            <div className={`grid gap-4 ${isEdit ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <Field label="Station">
                <input
                  type="text" placeholder="Mogadishu HQ" value={form.station || ''}
                  onChange={(e) => setForm({ ...form, station: e.target.value })}
                  className="w-full bg-slate-800/50 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500 transition-all text-sm"
                />
              </Field>
              {isEdit && (
                <Field label="New Password">
                  <input
                    type="password" placeholder="Blank = no change" value={form.password || ''}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full bg-slate-800/50 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-cyan-500 transition-all text-sm"
                  />
                </Field>
              )}
            </div>

            {/* Auto-password notice (add mode only) */}
            {!isEdit && (
              <>
                {otpNotice && (
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2.5 text-xs text-cyan-300">
                    {otpNotice}
                  </div>
                )}

                {otpError && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
                    {otpError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={onSendOtp}
                  disabled={sendingOtp || !form.name || !form.email}
                  className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: 'var(--brand)' }}
                >
                  <KeyRound size={17} />
                  {sendingOtp ? 'Sending OTP...' : pendingUser ? 'Resend OTP' : 'Verify OTP'}
                </button>

                {pendingUser && (
                  <Field label="OTP Code">
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter 6-digit OTP"
                      value={otpValue || ''}
                      onChange={(e) => handleInlineOtpChange(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-700/60 rounded-xl px-4 py-3 text-center text-xl tracking-[0.3em] font-black text-slate-100 focus:outline-none focus:border-cyan-500 transition-all"
                    />
                  </Field>
                )}

                <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 text-xs">
                  <span className="mt-0.5 shrink-0">🔒</span>
                  <span>Password is auto-generated and emailed to the user only.</span>
                </div>
              </>
            )}
          </form>
        </div>

        {/* ── Sticky footer — always visible ── */}
        <div className="shrink-0 px-6 py-4 border-t border-slate-800 bg-slate-900 rounded-b-2xl flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-white rounded-xl text-sm font-medium"
            style={{ backgroundColor: 'var(--brand)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="user-form"
            disabled={
              isEdit
                ? saving
                : (verifyingOtp || !pendingUser || (otpValue || '').length !== 6)
            }
            className="px-5 py-2.5 text-white rounded-xl text-sm font-medium shadow-md disabled:opacity-50"
            style={{ backgroundColor: 'var(--brand)' }}
          >
            {isEdit
              ? (saving ? 'Saving...' : 'Save')
              : (verifyingOtp ? 'Verifying...' : 'Verify & Finish')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
