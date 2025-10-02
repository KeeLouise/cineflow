import { useState } from "react";
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

    // Validate before submit
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
      // Keep generic to avoid enumeration
      setMsg("If the address exists, we’ve emailed reset instructions.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-4" style={{ maxWidth: 420 }}>
      <h1 className="h4 mb-3">Forgot your password?</h1>
      {msg && <div className="alert alert-info">{msg}</div>}
      {err && <div className="alert alert-danger">{err}</div>}

      <form onSubmit={onSubmit} noValidate>
        <label className="form-label">Email address</label>
        <input
          type="email"
          className={`form-control ${emailInvalid ? "is-invalid" : ""}`}
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
          required
          autoFocus
          autoComplete="email"
        />
        {emailInvalid && (
          <div className="invalid-feedback">Please enter a valid email address.</div>
        )}

        <button
          className="btn btn-dark mt-3 w-100"
          disabled={loading || !email || !isValidEmail(email)}
          title={!email || isValidEmail(email) ? "" : "Fix email address"}
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </div>
  );
}