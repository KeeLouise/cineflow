import React, { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import api from "@/api/client";
import { setTokens } from "@/api/auth";
import AuthLayout from "@/components/AuthLayout";
import AuthField from "@/components/AuthField";
import AuthButton from "@/components/AuthButton";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [needsOtp, setNeedsOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const params = new URLSearchParams(useLocation().search);
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
      } else {
        setErr(body?.detail || e2.message || "Login failed.");
      }
    } finally {
      setLoading(false);
    }
  }

  const footer = (
    <div className="auth-links">
      <Link to="/register">Create account</Link>
      <span>•</span>
      <Link to="/forgot-password">Forgot password?</Link>
    </div>
  );

  return (
    <AuthLayout
      title={needsOtp ? "Check your email" : "Welcome back"}
      subtitle={needsOtp ? "Enter the 6-digit code we sent to your address." : "Sign in to continue"}
      footer={footer}
    >
      {err && <div className="callout error">{err}</div>}
      {msg && <div className="callout info">{msg}</div>}

      {!needsOtp ? (
        <form onSubmit={onSubmit} className="vstack gap-12">
          <AuthField
            label="Username"
            value={username}
            onChange={(e)=>setUsername(e.target.value)}
            autoComplete="username"
            required
            autoFocus
          />
          <AuthField
            label="Password"
            type="password"
            value={password}
            onChange={(e)=>setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <AuthButton type="submit" loading={loading}>Continue</AuthButton>
        </form>
      ) : (
        <form onSubmit={onSubmit} className="vstack gap-12">
          <AuthField
            label="Verification code"
            value={otp}
            onChange={(e)=>setOtp(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            pattern="\d{6}"
            placeholder="123456"
            required
            autoFocus
          />
          <div className="hstack gap-8 wrap">
            <AuthButton type="submit" loading={loading}>Verify & Sign in</AuthButton>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => { setNeedsOtp(false); setOtp(""); setMsg(""); setErr(""); }}
            >
              Use a different account
            </button>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}