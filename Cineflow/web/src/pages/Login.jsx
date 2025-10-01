import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "@/api/client";
import { confirm2FAEmailLogin } from "@/api/account";
import { setTokens } from "@/api/auth";
import "@/styles/security.css";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const [mfaNeeded, setMfaNeeded] = useState(false);
  const [mfaToken, setMfaToken] = useState("");
  const [code, setCode] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const next = params.get("next") || "/dashboard";

  function completeLogin({ access, refresh }) {
    setTokens({ access, refresh });              
    window.dispatchEvent(new Event("auth-changed")); 
    navigate(next, { replace: true });            
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    try {
      const { data } = await api.post("/token/", { username, password });

      // Normal login (no MFA)
      if (data?.access && data?.refresh) {
        completeLogin({ access: data.access, refresh: data.refresh });
        return;
      }

      // MFA challenge
      if (data?.mfa_required && data?.mfa_token) {
        setMfaNeeded(true);
        setMfaToken(data.mfa_token);
        return;
      }

      setErr("Unexpected response from server.");
    } catch (e2) {
      const body = e2?.response?.data;
      if (body?.mfa_required && body?.mfa_token) {
        setMfaNeeded(true);
        setMfaToken(body.mfa_token);
        return;
      }
      setErr(body?.detail || e2.message || "Login failed.");
    }
  }

  async function onSubmitMFA(e) {
    e.preventDefault();
    setErr("");

    try {
      const data = await confirm2FAEmailLogin({ code, mfaToken });
      if (data?.access && data?.refresh) {
        completeLogin({ access: data.access, refresh: data.refresh });
        return;
      }
      setErr("Incorrect code. Try again.");
    } catch (e3) {
      setErr(e3?.response?.data?.detail || e3?.message || "MFA failed.");
    }
  }

  return (
    <div className="container py-4 security-page">
      <div className="glass security-card">
        <h1 className="h4 mb-3">{mfaNeeded ? "Check your email" : "Login"}</h1>
        {err && <div className="alert alert-danger">{err}</div>}

        {!mfaNeeded ? (
          <form onSubmit={onSubmit} className="verify-form">
            <label className="form-label">Username</label>
            <input
              className="form-control wl-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
            />

            <label className="form-label mt-2">Password</label>
            <input
              type="password"
              className="form-control wl-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            <div className="actions mt-3">
              <button className="btn btn-gradient" type="submit">
                Continue
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={onSubmitMFA} className="verify-form">
            <p className="text-muted">
              We’ve emailed a 6-digit verification code to your email address. Enter it to finish signing in.
            </p>
            <input
              className="form-control wl-input"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              required
              autoFocus
            />
            <div className="actions mt-3 d-flex gap-2">
              <button className="btn btn-gradient" type="submit">Verify</button>
              <button
                className="btn btn-outline-ghost"
                type="button"
                onClick={() => {
                  setMfaNeeded(false);
                  setMfaToken("");
                  setCode("");
                  setErr("");
                }}
              >
                Use a different account
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}