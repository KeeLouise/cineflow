import { useState } from "react";
import { requestPasswordReset } from "@/api/account";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setMsg(""); setErr(""); setLoading(true);
    try {
      await requestPasswordReset(email);
      setMsg("If the address exists, we’ve emailed reset instructions.");
    } catch (e2) {
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
      <form onSubmit={onSubmit}>
        <label className="form-label">Email address</label>
        <input
          type="email"
          className="form-control"
          value={email}
          onChange={(e)=>setEmail(e.target.value)}
          required
          autoFocus
        />
        <button className="btn btn-dark mt-3 w-100" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </div>
  );
}