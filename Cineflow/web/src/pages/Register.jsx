import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/api/client";
import AuthLayout from "@/components/AuthLayout";

/* Validators */
const isValidEmail = (v = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());

function analyzePassword(pw = "") {
  const lengthOK = pw.length >= 8;
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasNumber = /\d/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);

  let score = 0;
  if (lengthOK) {
    score = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
    if (pw.length >= 12) score += 1;
    if (score > 4) score = 4; // clamp
  }

  const label =
    score === 0 ? "Too weak" :
    score === 1 ? "Weak" :
    score === 2 ? "Okay" :
    score === 3 ? "Strong" : "Very strong";

  return {
    score, // 0..4
    label,
    checks: { lengthOK, hasLower, hasUpper, hasNumber, hasSymbol }
  };
}

/*  Component  */
export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr]   = useState("");
  const [ok, setOk]     = useState("");

  const [showPw, setShowPw] = useState(false);
  const [showCp, setShowCp] = useState(false);

  const navigate = useNavigate();

  const emailInvalid   = emailTouched && email && !isValidEmail(email);
  const pwAnalysis     = useMemo(() => analyzePassword(password), [password]);
  const passwordsMatch = confirm ? password === confirm : false;
  const pwTooShort     = Boolean(password) && password.length < 8;

  const canSubmit =
    !submitting &&
    username.trim().length > 0 &&
    isValidEmail(email) &&
    password.length >= 8 &&
    passwordsMatch;

  async function handleSubmit(e) {
    e.preventDefault();
    setErr(""); setOk("");

    if (!isValidEmail(email)) {
      setEmailTouched(true);
      setErr("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (!passwordsMatch) {
      setErr("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/register/", { username, email, password });
      setOk("Account created. Check your email to verify, then sign in.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (e) {
      const detail =
        e?.response?.data?.detail ||
        Object.values(e?.response?.data || {})?.[0]?.[0] ||
        e?.message ||
        "Registration failed. Try another username/email.";
      setErr(String(detail));
    } finally {
      setSubmitting(false);
    }
  }

  const footer = (
    <div className="auth-links">
      <span>Already have an account?</span>
      <Link to="/login">Sign in</Link>
    </div>
  );

  // strength -> width + class
  const strengthWidth = `${(pwAnalysis.score / 4) * 100}%`;
  const strengthClass = `pw-meter-fill s${pwAnalysis.score}`;
  const strengthLabelClass = `pw-meter-label s${pwAnalysis.score}`;

  return (
    <div className="auth-bg">
      <div className="auth-grid">
        <div className="auth-card">
          <div className="auth-header">
            <Link to="/" className="brand">
              <span className="brand-dot" />
              FilmFind
            </Link>
            <h1 className="auth-title">Create your account</h1>
            <p className="auth-subtitle">Join and start building your watchlists.</p>
          </div>

          <div className="auth-body">
            {/* Messages */}
            {err && <div className="callout error" role="alert">{err}</div>}
            {ok  && <div className="callout success" role="status">{ok}</div>}

            <form className="vstack gap-12" onSubmit={handleSubmit} noValidate>
              {/* Username */}
              <div className="field">
                <label htmlFor="reg-username" className="field-label">Username</label>
                <input
                  id="reg-username"
                  className="field-input"
                  value={username}
                  onChange={(e)=>setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              {/* Email */}
              <div className="field">
                <label htmlFor="reg-email" className="field-label">Email</label>
                <input
                  id="reg-email"
                  type="email"
                  className={`field-input ${emailInvalid ? "is-error" : ""}`}
                  value={email}
                  onChange={(e)=>setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  autoComplete="email"
                  required
                />
                {emailInvalid && (
                  <small className="field-help error">Please enter a valid email address.</small>
                )}
              </div>

              {/* Password */}
              <div className="field">
                <label htmlFor="reg-password" className="field-label">Password</label>
                <div className="hstack gap-8">
                  <input
                    id="reg-password"
                    type={showPw ? "text" : "password"}
                    className={`field-input ${pwTooShort ? "is-error" : ""}`}
                    value={password}
                    onChange={(e)=>setPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowPw(v => !v)}
                    aria-pressed={showPw ? "true" : "false"}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
                {pwTooShort && (
                  <small className="field-help error">At least 8 characters.</small>
                )}

                {/* Strength meter */}
                {password && (
                  <div className="pw-meter" aria-live="polite">
                    <div className="pw-meter-track">
                      <div className={strengthClass} style={{ width: strengthWidth }} />
                    </div>
                    <div className="pw-meter-row">
                      <span className={strengthLabelClass}>{pwAnalysis.label}</span>
                      <ul className="pw-meter-tips">
                        <li style={{opacity: pwAnalysis.checks.lengthOK ? 1 : .6}}>
                          8+ chars
                        </li>
                        <li style={{opacity: pwAnalysis.checks.hasUpper ? 1 : .6}}>
                          Uppercase
                        </li>
                        <li style={{opacity: pwAnalysis.checks.hasLower ? 1 : .6}}>
                          Lowercase
                        </li>
                        <li style={{opacity: pwAnalysis.checks.hasNumber ? 1 : .6}}>
                          Number
                        </li>
                        <li style={{opacity: pwAnalysis.checks.hasSymbol ? 1 : .6}}>
                          Symbol
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm */}
              <div className="field">
                <label htmlFor="reg-confirm" className="field-label">Confirm password</label>
                <div className="hstack gap-8">
                  <input
                    id="reg-confirm"
                    type={showCp ? "text" : "password"}
                    className={`field-input ${
                      confirm ? (passwordsMatch ? "is-success" : "is-error") : ""
                    }`}
                    value={confirm}
                    onChange={(e)=>setConfirm(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowCp(v => !v)}
                    aria-pressed={showCp ? "true" : "false"}
                    aria-label={showCp ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showCp ? "Hide" : "Show"}
                  </button>
                </div>
                {confirm && !passwordsMatch && (
                  <small className="field-help error">Passwords do not match.</small>
                )}
                {confirm && passwordsMatch && (
                  <small className="field-help success">Looks good!</small>
                )}
              </div>

              <button className="btn btn-primary" disabled={!canSubmit}>
                {submitting ? <span className="spinner" aria-hidden /> : null}
                {submitting ? "Creating…" : "Create account"}
              </button>
            </form>
          </div>

          <div className="auth-footer">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}