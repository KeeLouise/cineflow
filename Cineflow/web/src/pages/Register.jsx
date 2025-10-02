import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";

const isValidEmail = (v = "") =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());

export default function Register() {
  const [username, setUsername]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [error, setError]         = useState("");
  const [okMsg, setOkMsg]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);

  const navigate = useNavigate();

  const passwordsMatch = password && confirm && password === confirm;
  const pwTooShort = password && password.length < 8;
  const emailInvalid = emailTouched && email && !isValidEmail(email);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setOkMsg("");

    // Validate email before submit
    if (!isValidEmail(email)) {
      setEmailTouched(true);
      setError("Please enter a valid email address.");
      return;
    }
    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }
    if (pwTooShort) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/register/", { username, email, password });
      setOkMsg("Account created. Check your email to verify, then sign in.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        Object.values(err?.response?.data || {})?.[0]?.[0] ||
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
            className={`form-control ${emailInvalid ? "is-invalid" : ""}`}
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
            required
            autoComplete="email"
          />
          {emailInvalid && (
            <div className="invalid-feedback">Please enter a valid email address.</div>
          )}
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

        <button
          className="btn btn-gradient w-100"
          disabled={
            submitting ||
            !username ||
            !email ||
            !isValidEmail(email) ||
            !password ||
            pwTooShort ||
            !passwordsMatch
          }
        >
          {submitting ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}