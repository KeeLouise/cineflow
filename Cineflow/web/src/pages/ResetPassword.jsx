import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { confirmPasswordReset } from "@/api/account";
import PasswordStrength from "@/components/PasswordStrength";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    if (!token) {
      setErr("Missing reset token. Use the link from your email.");
    }
  }, [token]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setMsg(""); setPwErr("");

    if (password !== password2) {
      setPwErr("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setPwErr("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const data = await confirmPasswordReset({ token, password, password2 });
      setMsg(data?.detail || "Password reset. You can sign in now.");
    } catch (e2) {
      const detail = e2?.response?.data?.detail
        || e2?.response?.data?.password?.[0]
        || e2?.response?.data?.password2?.[0]
        || "Could not reset password.";
      setErr(detail);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-4" style={{ maxWidth: 420 }}>
      <h1 className="h4 mb-3">Choose a new password</h1>

      {msg && (
        <div className="alert alert-success">
          {msg}
          <div className="mt-3">
            <a className="btn btn-gradient" href="/login">Go to Login</a>
          </div>
        </div>
      )}
      {err && <div className="alert alert-danger">{err}</div>}

      {!msg && (
        <form onSubmit={onSubmit}>
          <label className="form-label">New password</label>
          <input
            type="password"
            className={`form-control ${pwErr ? "is-invalid" : ""}`}
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            required
            minLength={8}
            autoFocus
          />
          <PasswordStrength password={password} />

          <label className="form-label mt-2">Confirm new password</label>
          <input
            type="password"
            className={`form-control ${pwErr ? "is-invalid" : ""}`}
            value={password2}
            onChange={(e)=>setPassword2(e.target.value)}
            required
          />
          {pwErr && <div className="invalid-feedback">{pwErr}</div>}

          <button className="btn btn-dark mt-3 w-100" disabled={loading || !token}>
            {loading ? "Saving…" : "Reset password"}
          </button>
        </form>
      )}
    </div>
  );
}