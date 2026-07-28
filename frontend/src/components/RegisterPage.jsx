import { useState, useRef, useEffect } from "react";
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
  AuthFooter,
  AuthAlert,
  AuthOtpInput,
} from "./auth/AuthShell";

const swalBase = {
  background: "#fff",
  color: "#2c2825",
  confirmButtonColor: "#3d6b8c",
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [step, setStep] = useState("register");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const inputRefs = useRef([]);

  useEffect(() => {
    if (step === "otp") setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, [step]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = ["", "", "", "", "", ""];
    pasted.split("").forEach((ch, i) => { newOtp[i] = ch; });
    setOtp(newOtp);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const completeLogin = (user, token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    applyTheme(user.theme, { updateUser: true, emit: false });
    window.location.href = "/analysis";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      Swal.fire({
        title: "Password mismatch",
        text: "Password and confirm password do not match.",
        icon: "error",
        ...swalBase,
        confirmButtonColor: "#c44b4b",
      });
      return;
    }
    const normalizedPhone = form.phone.replace(/\s+/g, "").trim();
    if (!/^\+?\d{7,15}$/.test(normalizedPhone)) {
      Swal.fire({
        title: "Invalid phone number",
        text: "Please enter a valid phone number (digits only, e.g. ).",
        icon: "error",
        ...swalBase,
        confirmButtonColor: "#c44b4b",
      });
      return;
    }
    try {
      setLoading(true);
      setError("");
      const res = await API.post("/auth/register", {
        name: form.name,
        email: form.email,
        phone: normalizedPhone,
        password: form.password,
      });
      if (res.data.requiresVerification) setStep("otp");
    } catch (err) {
      Swal.fire({
        title: "Registration failed",
        text: err.response?.data?.message || "Please try again.",
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
      setError("Please enter the full 6-digit code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await API.post("/auth/verify-otp", {
        email: form.email.trim().toLowerCase(),
        otp: code,
      });
      if (res.data.token) {
        await Swal.fire({
          title: "Email verified",
          text: "You have successfully registered.",
          icon: "success",
          ...swalBase,
        });
        completeLogin(res.data.user, res.data.token);
        return;
      }
      setStep("success");
    } catch (err) {
      setError(err.response?.data?.message || "The code is incorrect or has expired.");
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setError("");
    try {
      await API.post("/auth/resend-otp", { email: form.email.trim().toLowerCase() });
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

        {step === "register" && (
          <>
            <AuthHeading
              title="Create account"
              subtitle="Register to start using analysis tools."
            />
            <form onSubmit={handleSubmit}>
              <AuthField label="Full name">
                <AuthInput name="name" value={form.name} onChange={handleChange} placeholder="Your name" required />
              </AuthField>
              <AuthField label="Email">
                <AuthInput name="email" type="email" value={form.email} onChange={handleChange} placeholder="name@example.com" required />
              </AuthField>
              <AuthField label="Phone number">
                <AuthInput name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="Enter Your Number" required />
              </AuthField>
              <AuthField label="Password">
                <AuthInput name="password" type="password" minLength={6} value={form.password} onChange={handleChange} placeholder="At least 6 characters" required />
              </AuthField>
              <AuthField label="Confirm password">
                <AuthInput name="confirmPassword" type="password" minLength={6} value={form.confirmPassword} onChange={handleChange} placeholder="Repeat password" required />
              </AuthField>
              <AuthButton type="submit" loading={loading}>
                {loading ? "Creating account..." : "Create account"}
              </AuthButton>
            </form>
            <AuthFooter>
              Already have an account? <AuthLink to="/login">Sign in</AuthLink>
            </AuthFooter>
          </>
        )}

        {step === "otp" && (
          <>
            <AuthHeading title="Verify your email" subtitle="We sent a code to" highlight={form.email} />
            <form onSubmit={handleVerifyOtp}>
              <AuthField label="6-digit code">
                <AuthOtpInput otp={otp} setOtp={setOtp} inputRefs={inputRefs} onPaste={handleOtpPaste} />
              </AuthField>
              {error && <AuthAlert type="error">{error}</AuthAlert>}
              <p className="auth-hint">Code expires in 15 minutes.</p>
              <AuthButton type="button" variant="outline" onClick={handleResendOtp} disabled={resending}>
                {resending ? "Sending..." : "Resend code"}
              </AuthButton>
              <div style={{ marginTop: "0.65rem" }}>
                <AuthButton type="submit" loading={loading} disabled={otp.join("").length < 6}>
                  {loading ? "Verifying..." : "Verify & continue"}
                </AuthButton>
              </div>
              <AuthGhostButton onClick={() => { setStep("register"); setOtp(["","","","","",""]); setError(""); }}>
                ← Back
              </AuthGhostButton>
            </form>
          </>
        )}

        {step === "success" && (
          <>
            <div className="auth-success-icon">✓</div>
            <AuthHeading title="Email verified" subtitle="You can now sign in to your account." />
            <AuthButton type="button" onClick={() => navigate("/login")}>
              Go to sign in
            </AuthButton>
          </>
        )}
      </AuthCard>
    </AuthPage>
  );
}
