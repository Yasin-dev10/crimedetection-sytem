import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import API from "../api";
import { applyTheme } from "../theme";
import {
  AuthPage,
  AuthCard,
  AuthBrand,
  AuthHeading,
  AuthField,
  AuthInput,
  AuthButton,
  AuthGhostButton,
  AuthLink,
  AuthDivider,
  AuthFooter,
  AuthAlert,
  AuthOtpInput,
} from "./auth/AuthShell";

const swalBase = {
  background: "#fff",
  color: "#2c2825",
  confirmButtonColor: "#3d6b8c",
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState("credentials");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (step === "otp") setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, [step]);

  const getHomePath = (role) => {
    if (role === "admin") return "/dashboard";
    if (role === "investigator") return "/cases";
    return "/analysis";
  };

  const finishLogin = (user, token, loginPassword) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    applyTheme(user.theme, { updateUser: true, emit: false });

    if (user.isPasswordChangeRequired) {
      navigate("/change-password", {
        replace: true,
        state: { firstLogin: true, currentPassword: loginPassword },
      });
      return;
    }
    window.location.href = getHomePath(user.role);
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = ["", "", "", "", "", ""];
    pasted.split("").forEach((ch, i) => { newOtp[i] = ch; });
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await API.post("/auth/login", { email, password });
      if (res.data.requiresOTP) {
        setStep("otp");
        setOtpError("");
        return;
      }
      finishLogin(res.data.user, res.data.token, password);
    } catch (err) {
      const data = err.response?.data;
      if (data?.requiresVerification) {
        Swal.fire({
          title: "Email not verified",
          text: data.message || "Please verify your email first.",
          icon: "warning",
          ...swalBase,
          confirmButtonText: "Verify email",
        }).then((r) => {
          if (r.isConfirmed) navigate(`/verify-email?email=${encodeURIComponent(data.email || email)}`);
        });
        return;
      }
      Swal.fire({
        title: "Login failed",
        text: data?.message || "Invalid email or password",
        icon: "error",
        ...swalBase,
        confirmButtonColor: "#c44b4b",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setOtpError("Please enter the full 6-digit code.");
      return;
    }
    setLoading(true);
    setOtpError("");
    try {
      const res = await API.post("/auth/verify-login-otp", {
        email: email.trim().toLowerCase(),
        otp: code,
      });
      finishLogin(res.data.user, res.data.token, password);
    } catch (err) {
      setOtpError(err.response?.data?.message || "The code is incorrect or has expired.");
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  const handleResendLoginOtp = async () => {
    setResending(true);
    setOtpError("");
    try {
      await API.post("/auth/resend-login-otp", { email: email.trim().toLowerCase() });
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err) {
      setOtpError(err.response?.data?.message || "Could not send a new code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthPage>
      <AuthCard>
        <AuthBrand />
        <AuthHeading
          title={step === "otp" ? "Enter verification code" : "Welcome back"}
          subtitle={
            step === "otp"
              ? "We sent a 6-digit code to"
              : "Sign in to continue to your workspace."
          }
          highlight={step === "otp" ? email : undefined}
        />

        {step === "credentials" ? (
          <>
            <form onSubmit={handleSubmit}>
              <AuthField label="Email address">
                <AuthInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </AuthField>

              <AuthField label="Password">
                <div className="auth-input-wrap">
                  <AuthInput
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    required
                  />
                  <button
                    type="button"
                    className="auth-toggle-pw"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label="Toggle password"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="auth-link-row">
                  <AuthLink to="/forgot-password">Forgot password?</AuthLink>
                </div>
              </AuthField>

              <AuthButton type="submit" loading={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </AuthButton>
            </form>

            <AuthDivider text="New here?" />
            <AuthFooter>
              Don&apos;t have an account? <AuthLink to="/register">Create account</AuthLink>
            </AuthFooter>
          </>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <AuthField label="6-digit code">
              <AuthOtpInput otp={otp} setOtp={setOtp} inputRefs={inputRefs} onPaste={handleOtpPaste} />
            </AuthField>

            {otpError && <AuthAlert type="error">{otpError}</AuthAlert>}
            <p className="auth-hint">Code expires in 15 minutes.</p>

            <AuthButton type="button" variant="outline" onClick={handleResendLoginOtp} disabled={resending}>
              {resending ? "Sending..." : "Resend code"}
            </AuthButton>

            <div style={{ marginTop: "0.65rem" }}>
              <AuthButton type="submit" loading={loading} disabled={otp.join("").length < 6}>
                {loading ? "Verifying..." : "Verify & sign in"}
              </AuthButton>
            </div>

            <AuthGhostButton
              onClick={() => {
                setStep("credentials");
                setOtp(["", "", "", "", "", ""]);
                setOtpError("");
              }}
            >
              ← Back to sign in
            </AuthGhostButton>
          </form>
        )}
      </AuthCard>
    </AuthPage>
  );
}
