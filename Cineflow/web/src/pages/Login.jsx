import React, { useState } from "react";
import api from "@/api/client";
import { confirm2FA } from "@/api/account";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [mfaNeeded, setMfaNeeded] = useState(false);
  const [mfaToken, setMfaToken] = useState("");
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      // Step 1: attempt normal login
      const { data } = await api.post("/token/", { username, password });

      // Case A: normal login success (no MFA required)
      if (data?.access && data?.refresh) {
        localStorage.setItem("access", data.access);
        localStorage.setItem("refresh", data.refresh);
        window.dispatchEvent(new Event("auth-changed"));
        navigate("/dashboard");
        return;
      }

      // Case B: MFA required
      if (data?.mfa_required && data?.mfa_token) {
        setMfaNeeded(true);
        setMfaToken(data.mfa_token);
        return;
      }

      setErr("Unexpected response from server.");
    } catch (e) {
      const body = e?.response?.data || {};
      if (body?.mfa_required && body?.mfa_token) {
        setMfaNeeded(true);
        setMfaToken(body.mfa_token);
        return;
      }
      setErr(body?.detail || e.message || "Login failed.");
    }
  }

  async function onSubmitMFA(e) {
    e.preventDefault();
    setErr("");
    try {
      const data = await confirm2FA({ code, mfaToken });
      if (data?.access && data?.refresh) {
        localStorage.setItem("access", data.access);
        localStorage.setItem("refresh", data.refresh);
        window.dispatchEvent(new Event("auth-changed"));
        navigate("/dashboard");
        return;
      }
      setErr("Incorrect code. Try again.");
    } catch (e2) {
      setErr(e2?.response?.data?.detail || e2?.message || "MFA failed.");
    }
  }

  function resetMFA() {
    setMfaNeeded(false);
    setMfaToken("");
    setCode("");
  }

  return (
    <div className="container py-4 security-page">
      <div className="glass security-card">
        <h1 className="h4 mb-3">{mfaNeeded ? "Two-Factor Verification" : "Login"}</h1>
        {err && <div className="alert alert-danger">{err}</div>}

        {!mfaNeeded ? (
          <form onSubmit={onSubmit} className="verify-form">
            <label className="form-label">Username</label>
            <input
              className="form-control wl-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
            <label className="form-label mt-2">Password</label>
            <input
              type="password"
              className="form-control wl-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="actions mt-3">
              <button className="btn btn-gradient" type="submit">Login</button>
            </div>
          </form>
        ) : (
          <form onSubmit={onSubmitMFA} className="verify-form">
            <p className="text-muted">Enter the 6-digit code from your authenticator app.</p>
            <input
              className="form-control wl-input"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              autoFocus
              required
            />
            <div className="actions mt-3 d-flex gap-2">
              <button className="btn btn-gradient" type="submit">Verify</button>
              <button className="btn btn-outline-ghost" type="button" onClick={resetMFA}>
                Use different account
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}