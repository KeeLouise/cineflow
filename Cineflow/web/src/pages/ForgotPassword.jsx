import { useState } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "@/api/account";

const isValidEmail = (v = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const emailInvalid = emailTouched && email && !isValidEmail(email);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(""); setErr("");

    if (!isValidEmail(email)) {
      setEmailTouched(true);
      setErr("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(email);
      setMsg("If the address exists, we’ve emailed reset instructions.");
    } catch {
      setMsg("If the address exists, we’ve emailed reset instructions.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-bg">
      <div className="auth-grid">
        <div className="auth-card">
          <div className="auth-header">
            <Link to="/" className="brand">
              <span className="brand-dot" />
              Cineflow
            </Link>
            <h1 className="auth-title">Forgot your password?</h1>
            <p className="auth-subtitle">We’ll send a reset link to your email.</p>
          </div>

          <div className="auth-body">
            {msg && <div className="callout info" role="status">{msg}</div>}
            {err && !msg && <div className="callout error" role="alert">{err}</div>}

            <form className="vstack gap-12" onSubmit={onSubmit} noValidate>
              <div className="field">
                <label htmlFor="fp-email" className="field-label">Email address</label>
                <input
                  id="fp-email"
                  type="email"
                  className={`field-input ${emailInvalid ? "is-error" : ""}`}
                  value={email}
                  onChange={(e)=>setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  autoComplete="email"
                  required
                  autoFocus
                />
                {emailInvalid && (
                  <small className="field-help error">Please enter a valid email address.</small>
                )}
              </div>

              <button
                className="btn btn-primary"
                disabled={loading || !email || !isValidEmail(email)}
                title={!email || isValidEmail(email) ? "" : "Fix email address"}
              >
                {loading ? <span className="spinner" aria-hidden /> : null}
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </div>

          <div className="auth-footer">
            <div className="auth-links">
              <Link to="/login">Back to sign in</Link>
              <span>•</span>
              <Link to="/register">Create account</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}