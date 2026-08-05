import { Link } from "react-router-dom";
import "./auth.css";

export function AuthPage({ children }) {
  return <div className="auth-page">{children}</div>;
}

export function AuthCard({ children }) {
  return <div className="auth-card">{children}</div>;
}

export function AuthBrand() {
  return (
    <div className="auth-brand">
      <div className="auth-brand-icon">BA</div>
      <span className="auth-brand-name">BAREAI</span>
    </div>
  );
}

export function AuthHeading({ title, subtitle, highlight }) {
  return (
    <div className="auth-heading">
      <h1>{title}</h1>
      {subtitle && (
        <p>
          {subtitle}
          {highlight && <span className="auth-highlight"> {highlight}</span>}
        </p>
      )}
    </div>
  );
}

export function AuthField({ label, children }) {
  return (
    <div className="auth-field">
      {label && <label className="auth-label">{label}</label>}
      {children}
    </div>
  );
}

export function AuthInput({ className = "", ...props }) {
  return <input className={`auth-input ${className}`.trim()} {...props} />;
}

export function AuthButton({ children, variant = "primary", loading, ...props }) {
  const cls = variant === "outline" ? "auth-btn-outline" : "auth-btn";
  return (
    <button className={cls} disabled={loading || props.disabled} {...props}>
      {loading ? (
        <span className="auth-btn-inner">
          <span className="auth-spinner" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export function AuthGhostButton({ children, ...props }) {
  return (
    <button type="button" className="auth-btn-ghost" {...props}>
      {children}
    </button>
  );
}

export function AuthLink({ to, children, className = "" }) {
  return (
    <Link to={to} className={`auth-link ${className}`.trim()}>
      {children}
    </Link>
  );
}

export function AuthTextLink({ href, children, onClick }) {
  if (onClick) {
    return (
      <button type="button" className="auth-btn-ghost" onClick={onClick} style={{ width: "auto", padding: 0 }}>
        {children}
      </button>
    );
  }
  return (
    <a href={href} className="auth-link">
      {children}
    </a>
  );
}

export function AuthDivider({ text }) {
  return (
    <div className="auth-divider">
      <div className="auth-divider-line" />
      {text && <span className="auth-divider-text">{text}</span>}
      <div className="auth-divider-line" />
    </div>
  );
}

export function AuthFooter({ children }) {
  return <div className="auth-footer">{children}</div>;
}

export function AuthAlert({ type = "error", children }) {
  return <div className={`auth-alert auth-alert-${type}`}>{children}</div>;
}

export function AuthOtpInput({ otp, setOtp, inputRefs, onPaste }) {
  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...otp];
    next[index] = value.slice(-1);
    setOtp(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="auth-otp-row" onPaste={onPaste}>
      {otp.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={`auth-otp-box${digit ? " filled" : ""}`}
        />
      ))}
    </div>
  );
}
