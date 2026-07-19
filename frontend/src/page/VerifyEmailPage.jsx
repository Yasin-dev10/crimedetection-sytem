import { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
} from "../components/auth/AuthShell";

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [step, setStep] = useState(searchParams.get("email") ? "otp" : "email");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setStep("otp");
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter all 6 digits.");
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await API.post("/auth/verify-otp", { email: email.trim().toLowerCase(), otp: code });
      setStep("success");
      setTimeout(() => navigate("/login"), 5000);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid or expired code. Please try again.");
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!email.trim()) {
      setError("Please enter your email address first.");
      setStep("email");
      return;
    }
    setResending(true);
    setError("");
    setNotice("");
    try {
      const res = await API.post("/auth/resend-otp", { email: email.trim().toLowerCase() });
      setOtp(["", "", "", "", "", ""]);
      setNotice(res.data?.message || "A new verification code has been sent.");
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } catch (err) {
      setError(err.response?.data?.message || "Could not resend code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthPage>
      <AuthCard>
        <AuthBrand />

        {step === "success" && (
          <>
            <div className="auth-success-icon">✓</div>
            <AuthHeading title="Email verified" subtitle="Your email is confirmed. You can now sign in." />
            <div className="auth-info-box">
              <p>Check your inbox for your temporary password if this is your first setup.</p>
            </div>
            <p className="auth-hint">Redirecting to sign in in 5 seconds...</p>
            <AuthButton type="button" onClick={() => navigate("/login")}>
              Go to sign in
            </AuthButton>
          </>
        )}

        {step === "email" && (
          <>
            <AuthHeading title="Email verification" subtitle="Enter your email to continue with verification." />
            <form onSubmit={handleEmailSubmit}>
              <AuthField label="Email address">
                <AuthInput
                  type="email"
                  required
                  autoFocus
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </AuthField>
              {error && <AuthAlert type="error">{error}</AuthAlert>}
              <AuthButton type="submit">Continue</AuthButton>
            </form>
          </>
        )}

        {step === "otp" && (
          <>
            <AuthGhostButton onClick={() => { setStep("email"); setError(""); setNotice(""); setOtp(["","","","","",""]); }}>
              ← Back
            </AuthGhostButton>
            <AuthHeading title="Enter verification code" subtitle="Sent to" highlight={email} />
            <form onSubmit={handleOtpSubmit}>
              <AuthField label="6-digit code">
                <AuthOtpInput otp={otp} setOtp={setOtp} inputRefs={inputRefs} onPaste={handleOtpPaste} />
              </AuthField>
              {error && <AuthAlert type="error">{error}</AuthAlert>}
              {notice && <AuthAlert type="success">{notice}</AuthAlert>}
              <div className="auth-info-box">
                <p>Code expires in 15 minutes. Check your spam folder if you don&apos;t see it.</p>
              </div>
              <AuthButton type="button" variant="outline" onClick={handleResendOtp} disabled={resending}>
                {resending ? "Sending..." : "Resend code"}
              </AuthButton>
              <div style={{ marginTop: "0.65rem" }}>
                <AuthButton type="submit" loading={loading} disabled={otp.join("").length < 6}>
                  {loading ? "Verifying..." : "Verify code"}
                </AuthButton>
              </div>
            </form>
          </>
        )}

        <AuthFooter>
          <AuthLink to="/login">← Back to sign in</AuthLink>
        </AuthFooter>
      </AuthCard>
    </AuthPage>
  );
}
