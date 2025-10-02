import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/client";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState("");
  const [done, setDone]       = useState(false);
  const [resending, setResending] = useState(false);
  const [msg, setMsg]         = useState("");

  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setMsg("");

    try {
      
      await api.post("/auth/register/", { username, email, password });

      // Do NOT auto-login; user is inactive until email verification
      setDone(true);
      setMsg("Account created. Check your email to verify before logging in.");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(detail || "Registration failed. Try another username/email.");
    }
  }

  async function handleResend() {
    setResending(true);
    setMsg("");
    try {
      // Public resend endpoint (generic 200 response)
      await api.post("/auth/resend/", { email });
      setMsg("If your account needs verification, we’ve sent a new email.");
    } catch {
      setMsg("Could not resend right now. Try again later.");
    } finally {
      setResending(false);
    }
  }

  if (done) {
    return (
      <div className="container mt-5" style={{ maxWidth: 420 }}>
        <h2 className="mb-3">Check your email ✉️</h2>
        {msg && <div className="alert alert-success">{msg}</div>}
        <p className="text-muted">
          Didn’t get it? Check spam, or resend below.
        </p>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-dark"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? "Resending…" : "Resend verification"}
          </button>
          <button className="btn btn-gradient ms-auto" onClick={() => navigate("/login")}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-5" style={{ maxWidth: 420 }}>
      <h2 className="mb-3">Register</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Username</label>
          <input className="form-control" value={username}
                 onChange={(e)=>setUsername(e.target.value)} required />
        </div>
        <div className="mb-3">
          <label className="form-label">Email</label>
          <input type="email" className="form-control" value={email}
                 onChange={(e)=>setEmail(e.target.value)} required />
        </div>
        <div className="mb-3">
          <label className="form-label">Password</label>
          <input type="password" className="form-control" value={password}
                 onChange={(e)=>setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-dark w-100">Sign Up</button>
      </form>
    </div>
  );
}