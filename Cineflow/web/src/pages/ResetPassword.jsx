import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { confirmPasswordReset } from "@/api/account";

/* --- password analysis --- */
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
    if (score > 4) score = 4;
  }

  const label =
    score === 0 ? "Too weak" :
    score === 1 ? "Weak" :
    score === 2 ? "Okay" :
    score === 3 ? "Strong" : "Very strong";

  return { score, label, checks: { lengthOK, hasLower, hasUpper, hasNumber, hasSymbol } };
}

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword]   = useState("");
  const [password2, setPassword2] = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [showCp, setShowCp]       = useState(false);

  const [msg, setMsg]     = useState("");
  const [err, setErr]     = useState("");
  const [pwErr, setPwErr] = useState("");
  const [loading, setLoading] = useState(false);

  const pw = useMemo(() => analyzePassword(password), [password]);
  const match = password2 ? password2 === password : false;
  const tooShort = Boolean(password) && password.length < 8;

  useEffect(() => {
    if (!token) setErr("Missing reset token. Use the link from your email.");
  }, [token]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setMsg(""); setPwErr("");

    if (tooShort) return setPwErr("Password must be at least 8 characters.");
    if (!match)   return setPwErr("Passwords do not match.");

    setLoading(true);
    try {
      const data = await confirmPasswordReset({ token, password, password2 });
      setMsg(data?.detail || "Password reset. You can sign in now.");
    } catch (e2) {
      const detail = e2?.response?.data?.detail
        || e2?.response?.data?.password?.[0]
        || e2?.response?.data?.password2?.[0]
        || "Could not reset password.";
      setErr(String(detail));
    } finally {
      setLoading(false);
    }
  }

  const strengthWidth = `${(pw.score / 4) * 100}%`;
  const strengthClass = `pw-meter-fill s${pw.score}`;
  const strengthLabelClass = `pw-meter-label s${pw.score}`;

  return (
    <div className="auth-bg">
      <div className="auth-grid">
        <div className="auth-card">
          <div className="auth-header">
            <Link to="/" className="brand">
              <span className="brand-dot" />
              FilmFind
            </Link>
            <h1 className="auth-title">Choose a new password</h1>
            <p className="auth-subtitle">Create a strong password to secure your account.</p>
          </div>

          <div className="auth-body">
            {msg && (
              <div className="callout success" role="status">
                {msg}
                <div className="mt-12">
                  <Link className="btn btn-primary" to="/login">Go to Login</Link>
                </div>
              </div>
            )}
            {!msg && err && <div className="callout error" role="alert">{err}</div>}

            {!msg && (
              <form className="vstack gap-12" onSubmit={onSubmit} noValidate>
                {/* New password */}
                <div className="field">
                  <label htmlFor="rpw" className="field-label">New password</label>
                  <div className="hstack gap-8">
                    <input
                      id="rpw"
                      type={showPw ? "text" : "password"}
                      className={`field-input ${tooShort ? "is-error" : ""}`}
                      value={password}
                      onChange={(e)=>setPassword(e.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setShowPw(v => !v)}
                    >
                      {showPw ? "Hide" : "Show"}
                    </button>
                  </div>
                  {tooShort && <small className="field-help error">At least 8 characters.</small>}

                  {/* Strength meter */}
                  {password && (
                    <div className="pw-meter" aria-live="polite">
                      <div className="pw-meter-track">
                        <div className={strengthClass} style={{ width: strengthWidth }} />
                      </div>
                      <div className="pw-meter-row">
                        <span className={strengthLabelClass}>{pw.label}</span>
                        <ul className="pw-meter-tips">
                          <li style={{opacity: pw.checks.lengthOK ? 1 : .6}}>8+ chars</li>
                          <li style={{opacity: pw.checks.hasUpper ? 1 : .6}}>Uppercase</li>
                          <li style={{opacity: pw.checks.hasLower ? 1 : .6}}>Lowercase</li>
                          <li style={{opacity: pw.checks.hasNumber ? 1 : .6}}>Number</li>
                          <li style={{opacity: pw.checks.hasSymbol ? 1 : .6}}>Symbol</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm */}
                <div className="field">
                  <label htmlFor="rpw2" className="field-label">Confirm new password</label>
                  <div className="hstack gap-8">
                    <input
                      id="rpw2"
                      type={showCp ? "text" : "password"}
                      className={`field-input ${password2 ? (match ? "is-success" : "is-error") : ""}`}
                      value={password2}
                      onChange={(e)=>setPassword2(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setShowCp(v => !v)}
                    >
                      {showCp ? "Hide" : "Show"}
                    </button>
                  </div>
                  {password2 && !match && (
                    <small className="field-help error">Passwords do not match.</small>
                  )}
                  {pwErr && <small className="field-help error">{pwErr}</small>}
                </div>

                <button className="btn btn-primary" disabled={loading || !token}>
                  {loading ? <span className="spinner" aria-hidden /> : null}
                  {loading ? "Saving…" : "Reset password"}
                </button>
              </form>
            )}
          </div>

          <div className="auth-footer">
            <div className="auth-links">
              <Link to="/login">Back to sign in</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}