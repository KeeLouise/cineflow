import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "@/api/client";
import { setTokens } from "@/api/auth";
import "@/styles/security.css";

const RESEND_COOLDOWN_SECONDS =
  Number(import.meta.env.VITE_OTP_RESEND_COOLDOWN) || 60;

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [needsOtp, setNeedsOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const next = params.get("next") || "/dashboard";

  function completeLogin({ access, refresh }) {
    setTokens({ access, refresh });
    window.dispatchEvent(new Event("auth-changed"));
    navigate(next, { replace: true });
  }

  async function submitToken() {
    const body = { username, password };
    if (needsOtp && otp) body.otp = otp;
    const { data } = await api.post("/token/", body);
    return data;
  }

  function startCooldown(seconds = RESEND_COOLDOWN_SECONDS) {
    setCooldown(seconds);
    const id = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr(""); setMsg(""); setLoading(true);

    try {
      const data = await submitToken();

      if (data?.access && data?.refresh) {
        completeLogin(data);
        return;
      }

      setErr("Unexpected response from server.");
    } catch (e2) {
      const body = e2?.response?.data || {};
      if (body?.otp) {
        setNeedsOtp(true);
        const text = Array.isArray(body.otp) ? body.otp[0] : String(body.otp);
        setMsg(text || "We emailed you a 6-digit code. Enter it to continue.");
        startCooldown(); // 60s
      } else {
        setErr(body?.detail || e2.message || "Login failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setMsg("Requesting a new code…");
    setErr("");
    setLoading(true);
    try {
      await api.post("/token/", { username, password });
      setMsg("We sent you a new code (check spam too).");
      startCooldown(); // 60s
    } catch (e2) {
      const body = e2?.response?.data || {};
      if (body?.otp) {
        const text = Array.isArray(body.otp) ? body.otp[0] : String(body.otp);
        setMsg(text || "We emailed you a 6-digit code.");
        startCooldown(); // 60s
      } else {
        setErr(body?.detail || e2.message || "Could not resend code.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container py-4 security-page">
      <div className="glass security-card">
        <h1 className="h4 mb-3">{needsOtp ? "Check your email" : "Login"}</h1>

        {err && <div className="alert alert-danger">{err}</div>}
        {msg && <div className="alert alert-info">{msg}</div>}

        {!needsOtp ? (
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
              <button className="btn btn-gradient" type="submit" disabled={loading}>
                {loading ? "Continuing…" : "Continue"}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="verify-form">
            <p className="text-muted">
              We’ve emailed a 6-digit verification code to your address. Enter it to finish signing in.
            </p>

            <input
              className="form-control wl-input"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="123456"
              required
              autoFocus
              autoComplete="one-time-code"
            />
            <div className="actions mt-3 d-flex gap-2">
              <button className="btn btn-gradient" type="submit" disabled={loading}>
                {loading ? "Verifying…" : "Verify & Sign in"}
              </button>
              <button
                className="btn btn-outline-ghost"
                type="button"
                onClick={() => {
                  setNeedsOtp(false);
                  setOtp("");
                  setMsg("");
                  setErr("");
                }}
              >
                Use a different account
              </button>
              <button
                className="btn btn-outline-dark ms-auto"
                type="button"
                onClick={onResend}
                disabled={loading || cooldown > 0}
                title={cooldown > 0 ? `You can resend in ${cooldown}s` : "Request a new code (rate-limited)"}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}