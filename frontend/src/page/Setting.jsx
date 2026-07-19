import { useEffect, useState } from "react";
import { Bell, Check, Key, Moon, Palette, Save, Shield, Sun, User } from "lucide-react";
import API from "../api";
import { applyTheme, getInitialTheme } from "../theme";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    badgeNumber: "",
    station: "",
    theme: getInitialTheme(),
    emailAlerts: true,
    pushNotifications: false,
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
  });

  const [phoneVerified, setPhoneVerified] = useState(false);
  const [smsVerificationEnabled, setSmsVerificationEnabled] = useState(false);
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneSmsLoading, setPhoneSmsLoading] = useState(false);
  const [phoneVerifyLoading, setPhoneVerifyLoading] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState("");

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: Shield },
    { id: "appearance", label: "Appearance", icon: Palette },
  ];

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);

        const res = await API.get("/auth/me");
        const user = res.data.user;
        const theme = user.theme || localStorage.getItem("theme") || "dark";

        setForm({
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
          badgeNumber: user.badgeNumber || "",
          station: user.station || "",
          theme,
          emailAlerts: user.emailAlerts ?? true,
          pushNotifications: user.pushNotifications ?? false,
        });
        setPhoneVerified(Boolean(user.phoneVerified));
        setSmsVerificationEnabled(Boolean(res.data.smsVerificationEnabled));

        applyTheme(theme);
      } catch (err) {
        setError(err.response?.data?.message || "Settings data could not be loaded.");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved("");
    setError("");

    try {
      const res = await API.patch("/auth/me", form);

      localStorage.setItem("user", JSON.stringify(res.data.user));
      applyTheme(res.data.user.theme || form.theme);

      setSaved("Settings saved successfully!");
      if (res.data.user?.phoneVerified !== undefined) {
        setPhoneVerified(Boolean(res.data.user.phoneVerified));
      }
    } catch (err) {
      setError(err.response?.data?.message || "Settings save failed.");
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(""), 3000);
    }
  };

  const sendPhoneVerification = async () => {
    setPhoneSmsLoading(true);
    setPhoneMessage("");
    setError("");

    try {
      const res = await API.post("/auth/send-phone-verification", {
        phone: form.phone.trim() || undefined,
      });
      setPhoneMessage(res.data.message || "Verification code sent.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not send SMS verification code.");
    } finally {
      setPhoneSmsLoading(false);
    }
  };

  const verifyPhone = async () => {
    setPhoneVerifyLoading(true);
    setPhoneMessage("");
    setError("");

    try {
      const res = await API.post("/auth/verify-phone", { code: phoneCode.trim() });
      setPhoneVerified(true);
      setPhoneCode("");
      setPhoneMessage(res.data.message || "Phone verified.");
    } catch (err) {
      setError(err.response?.data?.message || "Phone verification failed.");
    } finally {
      setPhoneVerifyLoading(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved("");
    setError("");

    try {
      await API.patch("/auth/change-password", passwordForm);

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
      });

      setSaved("Password changed successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Password change failed.");
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(""), 3000);
    }
  };

  return (
    <div
      className="w-full transition-colors duration-300"
      style={{
        backgroundColor: "var(--bg-base)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-sans)",
      }}
    >
        <div className="max-w-6xl mx-auto">
          <div
            className="mb-8 border-b pb-5"
            style={{ borderColor: "var(--border-base)" }}
          >
            <h1
              className="text-3xl font-extrabold tracking-tight"
              style={{ color: "var(--text-primary)" }}
            >
              System Settings
            </h1>

            <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
              Manage your profile, notifications, password, and application appearance.
            </p>

            {error && <p className="text-sm text-red-400 mt-3">{error}</p>}

            {saved && (
              <p className="text-sm mt-3 flex items-center gap-1" style={{ color: "var(--brand)" }}>
                <Check size={15} /> {saved}
              </p>
            )}
          </div>

          {loading ? (
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading settings...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="md:col-span-1 space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all border"
                      style={
                        isActive
                          ? {
                              backgroundColor: "var(--brand)",
                              color: "#ffffff",
                              borderColor: "var(--brand)",
                            }
                          : {
                              backgroundColor: "transparent",
                              color: "var(--text-muted)",
                              borderColor: "transparent",
                            }
                      }
                    >
                      <Icon size={18} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <div
                className="md:col-span-3 border rounded-2xl p-6 min-h-[450px] transition-colors duration-300"
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderColor: "var(--border-base)",
                }}
              >
                {activeTab === "profile" && (
                  <form onSubmit={saveSettings} className="space-y-6">
                    <PanelTitle
                      title="Profile Information"
                      text="Update your personal account information."
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field
                        label="Full Name"
                        value={form.name}
                        onChange={(value) => updateField("name", value)}
                      />

                      <Field
                        label="Email Address"
                        type="email"
                        value={form.email}
                        onChange={(value) => updateField("email", value)}
                      />

                      <Field
                        label="Phone Number"
                        placeholder="+252615588696 or 0615588696"
                        value={form.phone}
                        onChange={(value) => {
                          updateField("phone", value);
                          setPhoneVerified(false);
                        }}
                      />

                      <Field
                        label="Badge Number"
                        value={form.badgeNumber}
                        onChange={(value) => updateField("badgeNumber", value)}
                      />

                      <Field
                        label="Investigator Station"
                        value={form.station}
                        onChange={(value) => updateField("station", value)}
                        className="sm:col-span-2"
                      />
                    </div>

                    <div
                      className="rounded-xl border p-4 space-y-3"
                      style={{
                        borderColor: "var(--border-base)",
                        backgroundColor: "var(--bg-elevated)",
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p
                            className="text-sm font-semibold"
                            style={{ color: "var(--text-primary)" }}
                          >
                            SMS phone verification
                          </p>
                          <p
                            className="text-xs mt-1"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Verify your phone via Twilio for field alerts and account recovery.
                          </p>
                        </div>
                        {phoneVerified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                            <Check size={14} />
                            Verified
                          </span>
                        ) : null}
                      </div>

                      {!smsVerificationEnabled && (
                        <p className="text-xs border rounded-lg px-3 py-2 text-amber-600 bg-amber-500/10 border-amber-500/30">
                          SMS verification is not set up yet. Add Twilio credentials to <code className="text-[11px]">backend/.env</code> and restart the backend server.
                        </p>
                      )}

                      {!phoneVerified && (
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            type="button"
                            onClick={sendPhoneVerification}
                            disabled={phoneSmsLoading || !form.phone.trim() || !smsVerificationEnabled}
                            className="btn-secondary shrink-0"
                          >
                            {phoneSmsLoading ? "Sending..." : "Send SMS code"}
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="Enter 6-digit code"
                            value={phoneCode}
                            onChange={(e) => setPhoneCode(e.target.value)}
                            className="flex-1 rounded-lg border px-3 py-2 text-sm"
                            style={{
                              borderColor: "var(--border-base)",
                              backgroundColor: "var(--bg-elevated)",
                              color: "var(--text-primary)",
                            }}
                          />
                          <button
                            type="button"
                            onClick={verifyPhone}
                            disabled={phoneVerifyLoading || !phoneCode.trim()}
                            className="btn-primary shrink-0"
                          >
                            {phoneVerifyLoading ? "Verifying..." : "Verify phone"}
                          </button>
                        </div>
                      )}

                      {phoneMessage ? (
                        <p className="text-xs text-cyan-400">{phoneMessage}</p>
                      ) : null}
                    </div>

                    <SaveButton saving={saving} />
                  </form>
                )}

                {activeTab === "notifications" && (
                  <form onSubmit={saveSettings} className="space-y-6">
                    <PanelTitle
                      title="Notification Preferences"
                      text="Choose how you want to receive system notifications."
                    />

                    <ToggleRow
                      title="Email Notifications"
                      text="Receive important crime alerts by email."
                      checked={form.emailAlerts}
                      onChange={(checked) => updateField("emailAlerts", checked)}
                    />

                    <ToggleRow
                      title="Browser Notifications"
                      text="Show notifications directly in your browser."
                      checked={form.pushNotifications}
                      onChange={(checked) => updateField("pushNotifications", checked)}
                    />

                    <SaveButton saving={saving} />
                  </form>
                )}

                {activeTab === "security" && (
                  <form onSubmit={changePassword} className="space-y-6 max-w-md">
                    <PanelTitle
                      title="Change Password"
                      text="Update your account password."
                    />

                    <Field
                      label="Current Password"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(value) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          currentPassword: value,
                        }))
                      }
                    />

                    <Field
                      label="New Password"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(value) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          newPassword: value,
                        }))
                      }
                    />

                    <SaveButton
                      saving={saving}
                      label="Change Password"
                      icon={Key}
                    />
                  </form>
                )}

                {activeTab === "appearance" && (
                  <form onSubmit={saveSettings} className="space-y-6">
                    <PanelTitle
                      title="Application Theme"
                      text="Choose between Dark Mode and Light Mode."
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <ThemeCard
                        active={form.theme === "dark"}
                        icon={Moon}
                        title="Dark Mode"
                        text="Recommended for low-light environments."
                        onClick={() => {
                          updateField("theme", "dark");
                          applyTheme("dark");
                        }}
                      />

                      <ThemeCard
                        active={form.theme === "light"}
                        icon={Sun}
                        title="Light Mode"
                        text="Bright interface for daytime use."
                        onClick={() => {
                          updateField("theme", "light");
                          applyTheme("light");
                        }}
                      />
                    </div>

                    <SaveButton saving={saving} />
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
    </div>
  );
}

function PanelTitle({ title, text }) {
  return (
    <div>
      <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{text}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", className = "", placeholder = "" }) {
  return (
    <div className={className}>
      <label
        className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </label>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-3.5 py-2.5 text-sm border transition-all focus:outline-none"
        style={{
          backgroundColor: "var(--bg-elevated)",
          borderColor: "var(--border-base)",
          color: "var(--text-primary)",
        }}
      />
    </div>
  );
}

function ToggleRow({ title, text, checked, onChange }) {
  return (
    <div
      className="flex items-center justify-between gap-4 p-4 border rounded-xl"
      style={{
        backgroundColor: "var(--bg-elevated)",
        borderColor: "var(--border-base)",
      }}
    >
      <div>
        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{title}</div>
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>{text}</div>
      </div>

      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-9 h-5 rounded-full appearance-none cursor-pointer relative before:content-[''] before:absolute before:h-4 before:w-4 before:rounded-full before:top-0.5 before:left-0.5 before:transition-all checked:before:translate-x-4"
        style={{
          backgroundColor: checked ? "var(--brand)" : "var(--bg-card)",
        }}
      />
    </div>
  );
}

function ThemeCard({ active, icon: Icon, title, text, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left border rounded-xl p-5 transition-all"
      style={
        active
          ? {
              borderColor: "var(--brand)",
              backgroundColor: "var(--brand-soft)",
            }
          : {
              borderColor: "var(--border-base)",
              backgroundColor: "var(--bg-elevated)",
            }
      }
    >
      <Icon
        style={{ color: active ? "var(--brand)" : "var(--text-muted)" }}
        size={24}
      />

      <div className="font-bold mt-4" style={{ color: "var(--text-primary)" }}>{title}</div>
      <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{text}</div>
    </button>
  );
}

function SaveButton({ saving, label = "Save Changes", icon: Icon = Save }) {
  return (
    <div className="flex justify-end pt-5 border-t" style={{ borderColor: "var(--border-base)" }}>
      <button
        type="submit"
        disabled={saving}
        className="btn-primary"
      >
        <Icon size={16} />
        <span>{saving ? "Saving..." : label}</span>
      </button>
    </div>
  );
}
