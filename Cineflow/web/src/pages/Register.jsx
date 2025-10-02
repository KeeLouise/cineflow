import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";

export default function Register() {
  const [username, setUsername]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [error, setError]         = useState("");
  const [okMsg, setOkMsg]         = useState("");
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  const trimmedUsername = username.trim();
  const normalizedEmail = email.trim().toLowerCase();

  const passwordsMatch = !!password && !!confirm && password === confirm;
  const pwTooShort     = !!password && password.length < 8;
  const formInvalid    = pwTooShort || !passwordsMatch || !trimmedUsername || !normalizedEmail || submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    if (formInvalid) return;

    setError(""); 
    setOkMsg("");
    setSubmitting(true);

    try {
      await api.post("/auth/register/", {
        username: trimmedUsername,
        email: normalizedEmail,
        password,
      });

      setOkMsg("Account created. Check your inbox for the verification link.");

      setTimeout(() => navigate("/verify-email?ok=pending"), 1200);
    } catch (err) {
    
      const data = err?.response?.data || {};
      const fieldFirst =
        typeof data === "object"
          ? Object.values(data).find(v => Array.isArray(v) && v.length) || []
          : [];
      const detail =
        data?.detail ||
        fieldFirst[0] ||
        err?.message ||
        "Registration failed. Try another username/email.";
      setError(String(detail));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container mt-5" style={{ maxWidth: 420 }}>
      <h2 className="mb-3">Create your account</h2>

      {okMsg && <div className="alert alert-success">{okMsg}</div>}
      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-3">
          <label className="form-label">Username</label>
          <input
            className="form-control"
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
            required
            autoComplete="username"
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Email</label>
          <input
            type="email"
            className="form-control"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Password</label>
          <input
            type="password"
            className={`form-control ${pwTooShort ? "is-invalid" : ""}`}
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
          {pwTooShort && (
            <div className="invalid-feedback">At least 8 characters.</div>
          )}
        </div>

        <div className="mb-3">
          <label className="form-label">Confirm password</label>
          <input
            type="password"
            className={`form-control ${
              confirm
                ? (passwordsMatch ? "is-valid" : "is-invalid")
                : ""
            }`}
            value={confirm}
            onChange={(e)=>setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
          {confirm && !passwordsMatch && (
            <div className="invalid-feedback">Passwords do not match.</div>
          )}
        </div>

        <button className="btn btn-gradient w-100" disabled={formInvalid}>
          {submitting ? "Creating…" : "Create account"}
        </button>

        <p className="text-muted small mt-3 mb-0">
          We’ll email a verification link. Check spam if you don’t see it.
        </p>
      </form>
    </div>
  );
}