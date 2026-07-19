import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import API from "../api";
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
  AuthFooter,
  AuthAlert,
  AuthOtpInput,
} from "./auth/AuthShell";

const swalBase = {
  background: "#fff",
  color: "#2c2825",
  confirmButtonColor: "#3d6b8c",
};

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(searchParams.get("email") ? "otp" : "email");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef([]);

  useEffect(() => {
    if (step === "otp") setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, [step]);

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = ["", "", "", "", "", ""];
    pasted.split("").forEach((ch, i) => { newOtp[i] = ch; });
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await API.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
      setStep("otp");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpContinue = (e) => {
    e.preventDefault();
    if (otp.join("").length < 6) {
      setError("Please enter the full 6-digit code.");
      return;
    }
    setError("");
    setStep("password");
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Password and confirm password do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await API.post("/auth/reset-password-otp", {
        email: email.trim().toLowerCase(),
        otp: otp.join(""),
        newPassword,
      });
      await Swal.fire({
        title: "Password reset",
        text: "Your password has been successfully reset.",
        icon: "success",
        ...swalBase,
      });
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "The code is incorrect or has expired.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setError("");
    try {
      await API.post("/auth/resend-forgot-password-otp", { email: email.trim().toLowerCase() });
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(err.response?.data?.message || "Could not send a new code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthPage>
      <AuthCard>
        <AuthBrand />

        {step === "email" && (
          <>
            <AuthHeading title="Forgot password?" subtitle="Enter your email and we'll send you a reset code." />
            <form onSubmit={handleSendOtp}>
              <AuthField label="Email">
                <AuthInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" required autoFocus />
              </AuthField>
              {error && <AuthAlert type="error">{error}</AuthAlert>}
              <AuthButton type="submit" loading={loading}>
                {loading ? "Sending..." : "Send reset code"}
              </AuthButton>
            </form>
          </>
        )}

        {step === "otp" && (
          <>
            <AuthHeading title="Enter reset code" subtitle="We sent a code to" highlight={email} />
            <form onSubmit={handleOtpContinue}>
              <AuthField label="6-digit code">
                <AuthOtpInput otp={otp} setOtp={setOtp} inputRefs={inputRefs} onPaste={handleOtpPaste} />
              </AuthField>
              {error && <AuthAlert type="error">{error}</AuthAlert>}
              <p className="auth-hint">Code expires in 15 minutes.</p>
              <AuthButton type="button" variant="outline" onClick={handleResendOtp} disabled={resending}>
                {resending ? "Sending..." : "Resend code"}
              </AuthButton>
              <div style={{ marginTop: "0.65rem" }}>
                <AuthButton type="submit" disabled={otp.join("").length < 6}>Continue</AuthButton>
              </div>
              <AuthGhostButton onClick={() => { setStep("email"); setOtp(["","","","","",""]); setError(""); }}>
                Back
              </AuthGhostButton>
            </form>
          </>
        )}

        {step === "password" && (
          <>
            <AuthHeading title="Choose new password" subtitle="Create a strong password for your account." />
            <form onSubmit={handleResetPassword}>
              <AuthField label="New password">
                <AuthInput type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} placeholder="At least 6 characters" required autoFocus />
              </AuthField>
              <AuthField label="Confirm password">
                <AuthInput type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} placeholder="Repeat password" required />
              </AuthField>
              {error && <AuthAlert type="error">{error}</AuthAlert>}
              <AuthButton type="submit" loading={loading}>
                {loading ? "Resetting..." : "Reset password"}
              </AuthButton>
              <AuthGhostButton onClick={() => { setStep("otp"); setError(""); }}>
                Back to code
              </AuthGhostButton>
            </form>
          </>
        )}

        <AuthFooter>
          <AuthLink to="/login">Back to sign in</AuthLink>
        </AuthFooter>
      </AuthCard>
    </AuthPage>
  );
}
