import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import API from "../api.js";
import { applyTheme } from "../theme.js";
import {
  AuthPage,
  AuthCard,
  AuthBrand,
  AuthHeading,
  AuthField,
  AuthInput,
  AuthButton,
  AuthAlert,
} from "../components/auth/AuthShell";

const homeByRole = {
  admin: "/dashboard",
  investigator: "/cases",
  user: "/analysis",
};

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

export default function ChangePasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const token = searchParams.get("token");
  const storedToken = localStorage.getItem("token");
  const storedUser = getStoredUser();
  const isFirstLoginMode = !token && Boolean(storedToken && storedUser?.isPasswordChangeRequired);
  const canChangePassword = Boolean(token || isFirstLoginMode);

  const [formData, setFormData] = useState({
    currentPassword: location.state?.currentPassword || "",
    newPassword: "",
    confirmPassword: "",
  });
  const [status, setStatus] = useState("form");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState({});

  const pageCopy = isFirstLoginMode
    ? {
        title: "Create your password",
        subtitle: "Use your temporary password once, then choose a private one.",
        button: "Save password & continue",
      }
    : {
        title: "Change password",
        subtitle: "Enter your new password to complete verification.",
        button: "Change password",
      };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const nextErrors = {};
    if (isFirstLoginMode && !formData.currentPassword) {
      nextErrors.currentPassword = "Temporary password is required";
    }
    if (!formData.newPassword) {
      nextErrors.newPassword = "Password is required";
    } else if (formData.newPassword.length < 6) {
      nextErrors.newPassword = "Password must be at least 6 characters";
    }
    if (!formData.confirmPassword) {
      nextErrors.confirmPassword = "Please confirm your password";
    } else if (formData.newPassword !== formData.confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleFirstLoginPasswordChange = async () => {
    const response = await API.patch("/auth/change-password", {
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword,
    });
    const updatedUser = {
      ...storedUser,
      ...(response.data?.user || {}),
      isPasswordChangeRequired: false,
    };
    localStorage.setItem("user", JSON.stringify(updatedUser));
    applyTheme(updatedUser.theme, { updateUser: true, emit: false });
    setStatus("success");
    setMessage("Password saved. Opening your workspace...");
    setTimeout(() => navigate(homeByRole[updatedUser.role] || "/analysis", { replace: true }), 1200);
  };

  const handleTokenPasswordChange = async () => {
    await API.post("/auth/change-password-verified", {
      token,
      newPassword: formData.newPassword,
    });
    setStatus("success");
    setMessage("Password changed. Redirecting to sign in...");
    setTimeout(() => navigate("/login", { replace: true }), 1800);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canChangePassword) {
      setStatus("error");
      setMessage("Session expired. Please sign in again.");
      return;
    }
    if (!validateForm()) return;
    setStatus("loading");
    setMessage("");
    try {
      if (isFirstLoginMode) await handleFirstLoginPasswordChange();
      else await handleTokenPasswordChange();
    } catch (error) {
      setStatus("error");
      setMessage(error.response?.data?.message || `An error occurred: ${error.message}`);
    }
  };

  return (
    <AuthPage>
      <AuthCard>
        <AuthBrand />
        <AuthHeading title={pageCopy.title} subtitle={pageCopy.subtitle} />

        {!canChangePassword && (
          <>
            <AuthAlert type="error">Password change session is missing. Please sign in again.</AuthAlert>
            <AuthButton type="button" onClick={() => navigate("/login", { replace: true })}>
              Back to sign in
            </AuthButton>
          </>
        )}

        {status === "success" && <AuthAlert type="success">{message}</AuthAlert>}

        {status === "error" && message && canChangePassword && (
          <>
            <AuthAlert type="error">{message}</AuthAlert>
            <AuthButton type="button" onClick={() => navigate("/login", { replace: true })}>
              Back to sign in
            </AuthButton>
          </>
        )}

        {(status === "form" || status === "loading") && canChangePassword && (
          <form onSubmit={handleSubmit}>
            {isFirstLoginMode && (
              <PasswordField
                label="Temporary password"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                placeholder="From your email"
                error={errors.currentPassword}
              />
            )}
            <PasswordField
              label="New password"
              name="newPassword"
              value={formData.newPassword}
              onChange={handleChange}
              placeholder="At least 6 characters"
              error={errors.newPassword}
            />
            <PasswordField
              label="Confirm password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Repeat password"
              error={errors.confirmPassword}
            />
            <div style={{ marginTop: "1rem" }}>
              <AuthButton type="submit" loading={status === "loading"}>
                {status === "loading" ? "Saving..." : pageCopy.button}
              </AuthButton>
            </div>
          </form>
        )}
      </AuthCard>
    </AuthPage>
  );
}

function PasswordField({ label, name, value, onChange, placeholder, error }) {
  return (
    <AuthField label={label}>
      <AuthInput
        type="password"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={error ? { borderColor: "#e0b4b4" } : undefined}
      />
      {error && <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "#9b3b3b" }}>{error}</p>}
    </AuthField>
  );
}
